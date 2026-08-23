/**
 * Walkover logic: when every opponent leaves a live match, the last player
 * standing wins by default.
 *
 * The rule only applies to matches that actually had two or more members at
 * some point. A solo room (one player versus the AI benchmark) starts with a
 * roster of one, so `sawMultiplayer` guards against awarding an instant win
 * there.
 */

export type WalkoverInput = {
  /** The room's current status ('playing' while a match is live). */
  roomStatus: string | null | undefined;
  /** Id of the persisted match for the current plan, if any. */
  matchId: string | null | undefined;
  /** Current number of roster members. */
  rosterSize: number;
  /** True once this match has been observed with two or more roster members. */
  sawMultiplayer: boolean;
};

/**
 * True when the caller should end the match with a walkover win for the last
 * remaining player.
 */
export function shouldAwardWalkover(input: WalkoverInput): boolean {
  return (
    input.roomStatus === 'playing' &&
    input.matchId != null &&
    input.sawMultiplayer &&
    input.rosterSize === 1
  );
}
