/**
 * Rules index — exports all built-in rules, interactions, and registry factory
 */

// Core interfaces
export {
  type ScoringRule,
  type SqlFragment,
  type NormalizedInput,
  type CandidateRecord,
  type RuleExplanation,
} from "./ScoringRule";
export { type RuleInteraction, type InteractionExplanation, ruleMatched } from "./RuleInteraction";
export { RuleRegistry } from "./RuleRegistry";

// Built-in rules
export { NameSimilarityRule } from "./builtin/NameSimilarityRule";
export { AddressMatchRule } from "./builtin/AddressMatchRule";
export { ProximityRule } from "./builtin/ProximityRule";
export { ProvisionalNumberRule } from "./builtin/ProvisionalNumberRule";
export { EstablishmentTypeRule } from "./builtin/EstablishmentTypeRule";
export { PostalCodeRule } from "./builtin/PostalCodeRule";
export { FloorPenaltyRule } from "./builtin/FloorPenaltyRule";
export { LocationDetailsPenaltyRule } from "./builtin/LocationDetailsPenaltyRule";
export { AccessInstructionsPenaltyRule } from "./builtin/AccessInstructionsPenaltyRule";

// Built-in interactions
export { SameBuildingDifferentUnit } from "./interactions/SameBuildingDifferentUnit";
export { AddressVariantSamePlace } from "./interactions/AddressVariantSamePlace";

// Convenience imports for the factory
import { NameSimilarityRule } from "./builtin/NameSimilarityRule";
import { AddressMatchRule } from "./builtin/AddressMatchRule";
import { ProximityRule } from "./builtin/ProximityRule";
import { ProvisionalNumberRule } from "./builtin/ProvisionalNumberRule";
import { EstablishmentTypeRule } from "./builtin/EstablishmentTypeRule";
import { PostalCodeRule } from "./builtin/PostalCodeRule";
import { FloorPenaltyRule } from "./builtin/FloorPenaltyRule";
import { LocationDetailsPenaltyRule } from "./builtin/LocationDetailsPenaltyRule";
import { AccessInstructionsPenaltyRule } from "./builtin/AccessInstructionsPenaltyRule";
import { SameBuildingDifferentUnit } from "./interactions/SameBuildingDifferentUnit";
import { AddressVariantSamePlace } from "./interactions/AddressVariantSamePlace";
import { RuleRegistry } from "./RuleRegistry";

/**
 * Create a RuleRegistry with the 9 built-in rules + 2 interactions.
 * This is the default configuration for all duplicate detection flows.
 */
export function createDefaultRegistry(): RuleRegistry {
  return new RuleRegistry(
    // Individual rules
    [
      new NameSimilarityRule(0.9), // +30
      new AddressMatchRule(), // +25
      new ProximityRule(5), // +20 (< 5 meters)
      new ProvisionalNumberRule(), // +15
      new EstablishmentTypeRule(), // +10
      new PostalCodeRule(), // +5
      new FloorPenaltyRule(), // -20
      new LocationDetailsPenaltyRule(), // -20
      new AccessInstructionsPenaltyRule(), // -15
    ],
    // Conditional interactions
    [
      new SameBuildingDifferentUnit(), // address✓ + floor≠ → -30
      new AddressVariantSamePlace(), // address✗ + coords_close✓ + type✓ → +15
    ]
  );
}
