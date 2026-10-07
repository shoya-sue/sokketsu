// Anchor 0.31 の #[program] がモジュールの外へ展開するコードが、非推奨の AccountInfo::realloc を呼ぶ。
// このクレート自身は realloc を使わない（Anchor 側の更新で外す）。
#![allow(deprecated)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;
use anchor_lang::system_program;

declare_id!("Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp");

/// release / refund 判断を執行してよい確率の下限（bps）。
pub const RELEASE_THRESHOLD_BPS: u16 = 7000;
pub const MAX_PROBABILITY_BPS: u16 = 10000;
pub const MAX_DEADLINE_SLOTS: u64 = 1500;

pub const DECISION_NONE: u8 = 0;
pub const DECISION_RELEASE: u8 = 1;
pub const DECISION_HOLD: u8 = 2;
pub const DECISION_REFUND: u8 = 3;

pub const STATUS_OPEN: u8 = 0;
pub const STATUS_SETTLED: u8 = 1;
pub const STATUS_REFUNDED: u8 = 2;

/// 判断に署名するオラクル（Pages Function）の公開鍵。
/// ローカルテストは公開してよい固定鍵（seed = [9; 32]）、devnet は本番の鍵。
#[cfg(feature = "localnet-oracle")]
pub const ORACLE_PUBKEY: Pubkey = pubkey!("J2xccRtuG43drESLYznHhLhQkLTdfepcKYbiQ9BsJVaf");
#[cfg(not(feature = "localnet-oracle"))]
pub const ORACLE_PUBKEY: Pubkey = pubkey!("DBYrETRocKoD4yBaWm2EvqSiqZ4T8SAfw6zDmmHiqHu5");

/// 署名対象: prefix(20) || escrow(32) || state_hash(32) || decision(1) || probability_bps(2, LE)
/// escrow を含めるので、同じ依頼文でも別の escrow に署名を使い回せない。
pub const DECISION_MESSAGE_PREFIX: &[u8] = b"sokketsu-decision-v2";
pub const DECISION_MESSAGE_LEN: usize = 20 + 32 + 32 + 1 + 2;

pub fn decision_message(
    escrow: &Pubkey,
    state_hash: &[u8; 32],
    decision: u8,
    probability_bps: u16,
) -> [u8; DECISION_MESSAGE_LEN] {
    let mut message = [0u8; DECISION_MESSAGE_LEN];
    message[..20].copy_from_slice(DECISION_MESSAGE_PREFIX);
    message[20..52].copy_from_slice(escrow.as_ref());
    message[52..84].copy_from_slice(state_hash);
    message[84] = decision;
    message[85..87].copy_from_slice(&probability_bps.to_le_bytes());
    message
}

/// 直前の命令が Ed25519 検証命令で、オラクルの公開鍵とこの判断のメッセージを検証していることを確かめる。
/// 署名そのものの正しさは ed25519 ネイティブプログラムが検証済み（不正なら取引ごと失敗する）。
fn verify_oracle_decision(
    instructions: &AccountInfo,
    escrow: &Pubkey,
    state_hash: &[u8; 32],
    decision: u8,
    probability_bps: u16,
) -> Result<()> {
    let current = ix_sysvar::load_current_index_checked(instructions)? as usize;
    require!(current > 0, SokketsuError::MissingOracleSignature);
    let ix = ix_sysvar::load_instruction_at_checked(current - 1, instructions)?;
    require_keys_eq!(
        ix.program_id,
        ed25519_program::ID,
        SokketsuError::MissingOracleSignature
    );

    // Ed25519 命令のデータ: [署名数 u8][padding u8][offsets 7×u16 ...][データ]
    let data = &ix.data;
    require!(
        data.len() >= 16 && data[0] == 1,
        SokketsuError::BadOracleSignature
    );
    let field = |i: usize| u16::from_le_bytes([data[i], data[i + 1]]);
    let (sig_ix, pk_off, pk_ix) = (field(4), field(6) as usize, field(8));
    let (msg_off, msg_len, msg_ix) = (field(10) as usize, field(12) as usize, field(14));
    // 公開鍵・署名・メッセージはすべてこの命令自身のデータ内にあること（他の命令を参照させない）。
    require!(
        sig_ix == u16::MAX && pk_ix == u16::MAX && msg_ix == u16::MAX,
        SokketsuError::BadOracleSignature
    );
    let pubkey = data
        .get(pk_off..pk_off + 32)
        .ok_or(SokketsuError::BadOracleSignature)?;
    require!(
        pubkey == ORACLE_PUBKEY.as_ref(),
        SokketsuError::BadOracleSignature
    );
    let message = data
        .get(msg_off..msg_off + msg_len)
        .ok_or(SokketsuError::BadOracleSignature)?;
    require!(
        message == decision_message(escrow, state_hash, decision, probability_bps).as_slice(),
        SokketsuError::BadOracleSignature
    );
    Ok(())
}

#[program]
pub mod sokketsu {
    use super::*;

    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        state_hash: [u8; 32],
        deadline_slots: u64,
    ) -> Result<()> {
        require!(amount > 0, SokketsuError::AmountZero);
        require!(
            (1..=MAX_DEADLINE_SLOTS).contains(&deadline_slots),
            SokketsuError::BadDeadline
        );

        // レントは init が払う。ここで送るのは預かり金だけ。
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        let deadline_slot = Clock::get()?
            .slot
            .checked_add(deadline_slots)
            .ok_or(SokketsuError::BadDeadline)?;

        ctx.accounts.escrow.set_inner(Escrow {
            payer: ctx.accounts.payer.key(),
            payee: ctx.accounts.payee.key(),
            amount,
            deadline_slot,
            state_hash,
            decision: DECISION_NONE,
            probability_bps: 0,
            bumped: ctx.bumps.escrow,
            status: STATUS_OPEN,
        });
        Ok(())
    }

    pub fn settle(ctx: Context<Settle>, decision: u8, probability_bps: u16) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(escrow.status == STATUS_OPEN, SokketsuError::NotOpen);
        require!(
            escrow.decision == DECISION_NONE,
            SokketsuError::AlreadyDecided
        );
        require!(
            (DECISION_RELEASE..=DECISION_REFUND).contains(&decision),
            SokketsuError::BadDecision
        );
        require!(
            probability_bps <= MAX_PROBABILITY_BPS,
            SokketsuError::BadProbability
        );
        // 判断はオラクルの署名付きでなければ受け付けない（クライアントによる書き換えを防ぐ）。
        verify_oracle_decision(
            &ctx.accounts.instructions.to_account_info(),
            &ctx.accounts.escrow.key(),
            &escrow.state_hash,
            decision,
            probability_bps,
        )?;

        let release = decision == DECISION_RELEASE && probability_bps >= RELEASE_THRESHOLD_BPS;
        if release {
            // escrow はプログラム所有のデータ口座なので system transfer は使えない。
            let amount = escrow.amount;
            ctx.accounts.escrow.sub_lamports(amount)?;
            ctx.accounts.payee.add_lamports(amount)?;
        }

        let escrow = &mut ctx.accounts.escrow;
        escrow.decision = decision;
        escrow.probability_bps = probability_bps;
        if release {
            escrow.status = STATUS_SETTLED;
        }
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(escrow.status == STATUS_OPEN, SokketsuError::NotOpen);

        let deadline_passed = Clock::get()?.slot >= escrow.deadline_slot;
        let refund_decided =
            escrow.decision == DECISION_REFUND && escrow.probability_bps >= RELEASE_THRESHOLD_BPS;
        require!(
            deadline_passed || refund_decided,
            SokketsuError::RefundNotAllowed
        );

        let amount = escrow.amount;
        ctx.accounts.escrow.sub_lamports(amount)?;
        ctx.accounts.payer.add_lamports(amount)?;
        ctx.accounts.escrow.status = STATUS_REFUNDED;
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status != STATUS_OPEN,
            SokketsuError::NotFinished
        );
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, state_hash: [u8; 32])]
pub struct Deposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: 受注者の公開鍵を記録するだけで、読み書きしない。
    pub payee: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", payer.key().as_ref(), state_hash.as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", payer.key().as_ref(), escrow.state_hash.as_ref()],
        bump = escrow.bumped,
        has_one = payer,
        has_one = payee
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub payee: SystemAccount<'info>,
    /// CHECK: instructions sysvar（アドレスで固定）。直前の Ed25519 命令を読む。
    #[account(address = ix_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", payer.key().as_ref(), escrow.state_hash.as_ref()],
        bump = escrow.bumped,
        has_one = payer
    )]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", payer.key().as_ref(), escrow.state_hash.as_ref()],
        bump = escrow.bumped,
        has_one = payer,
        close = payer
    )]
    pub escrow: Account<'info, Escrow>,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub payer: Pubkey,
    pub payee: Pubkey,
    pub amount: u64,
    pub deadline_slot: u64,
    pub state_hash: [u8; 32],
    pub decision: u8,
    pub probability_bps: u16,
    pub bumped: u8,
    pub status: u8,
}

#[error_code]
pub enum SokketsuError {
    #[msg("amount は 0 より大きくする")]
    AmountZero,
    #[msg("deadline_slots は 1〜1500")]
    BadDeadline,
    #[msg("decision は 1, 2, 3 のみ")]
    BadDecision,
    #[msg("probability_bps は 0〜10000")]
    BadProbability,
    #[msg("escrow が open ではない")]
    NotOpen,
    #[msg("この escrow は判断済み")]
    AlreadyDecided,
    #[msg("期限前で、refund 判断の閾値も満たさない")]
    RefundNotAllowed,
    #[msg("escrow がまだ open")]
    NotFinished,
    #[msg("判断にオラクルの署名が無い")]
    MissingOracleSignature,
    #[msg("オラクルの署名が判断と一致しない")]
    BadOracleSignature,
}
