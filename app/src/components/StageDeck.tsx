/**
 * 舞台の奥に敷く演出（#56）。遠近の付いた床のグリッドと、金庫の裏の巨大な「即決」。
 * 工程の進み具合は舞台の下の EscrowSteps で見せる。
 */
export function StageDeck() {
  return (
    <div className="deck" aria-hidden="true">
      <div className="deck-floor">
        <div className="deck-floor-grid" />
      </div>
      <span className="deck-kanji">即決</span>
    </div>
  );
}
