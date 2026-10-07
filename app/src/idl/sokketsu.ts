/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sokketsu.json`.
 */
export type Sokketsu = {
  "address": "Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp",
  "metadata": {
    "name": "sokketsu",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "close",
      "discriminator": [
        98,
        165,
        201,
        177,
        108,
        65,
        206,
        96
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "escrow.state_hash",
                "account": "escrow"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "payee"
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "arg",
                "path": "stateHash"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "stateHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "deadlineSlots",
          "type": "u64"
        },
        {
          "name": "operator",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "refund",
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "escrow.state_hash",
                "account": "escrow"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "settle",
      "docs": [
        "オラクルが署名した判断を執行する。",
        "Jev の判断は誰が出してもよい（発注者が出さなくても受注者が払われる）。",
        "モックの判断は認証なしで取れるので、発注者か預け入れ時に登録した操作鍵だけが出せる。"
      ],
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "submitter",
          "docs": [
            "判断を提出する鍵。Jev の判断なら誰でもよい。モックなら payer か operator（settle で検査）。"
          ],
          "signer": true
        },
        {
          "name": "payer",
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "account",
                "path": "escrow.state_hash",
                "account": "escrow"
              }
            ]
          }
        },
        {
          "name": "payee",
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "instructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "decision",
          "type": "u8"
        },
        {
          "name": "probabilityBps",
          "type": "u16"
        },
        {
          "name": "source",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrow",
      "discriminator": [
        31,
        213,
        123,
        187,
        186,
        22,
        218,
        155
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "amountZero",
      "msg": "amount は 0 より大きくする"
    },
    {
      "code": 6001,
      "name": "badDeadline",
      "msg": "deadline_slots は 1〜1500"
    },
    {
      "code": 6002,
      "name": "badDecision",
      "msg": "decision は 1, 2, 3 のみ"
    },
    {
      "code": 6003,
      "name": "badProbability",
      "msg": "probability_bps は 0〜10000"
    },
    {
      "code": 6004,
      "name": "notOpen",
      "msg": "escrow が open ではない"
    },
    {
      "code": 6005,
      "name": "alreadyDecided",
      "msg": "この escrow は判断済み"
    },
    {
      "code": 6006,
      "name": "refundNotAllowed",
      "msg": "期限前で、refund 判断の閾値も満たさない"
    },
    {
      "code": 6007,
      "name": "notFinished",
      "msg": "escrow がまだ open"
    },
    {
      "code": 6008,
      "name": "missingOracleSignature",
      "msg": ""
    },
    {
      "code": 6009,
      "name": "badOracleSignature",
      "msg": ""
    },
    {
      "code": 6010,
      "name": "badSource",
      "msg": "source は 1（Jev）か 2（モック）のみ"
    },
    {
      "code": 6011,
      "name": "unauthorizedSubmitter",
      "msg": ""
    }
  ],
  "types": [
    {
      "name": "escrow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "payee",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "docs": [
              "モックの判断を settle してよい操作鍵（ブラウザ内の鍵。発注者の承認を 1 回で済ませるため）。"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "deadlineSlot",
            "type": "u64"
          },
          {
            "name": "stateHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "decision",
            "type": "u8"
          },
          {
            "name": "probabilityBps",
            "type": "u16"
          },
          {
            "name": "bumped",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "source",
            "docs": [
              "settle された判断の出所（SOURCE_*）。"
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
