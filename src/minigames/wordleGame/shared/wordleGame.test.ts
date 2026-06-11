import { evaluate_guess, valid_input, is_solved, get_game_state, get_random_word, is_valid_word} from "./wordleGame"

// ─── valid_input ───────────────────────────────────────────────
console.log("=== valid_input ===")
console.log(valid_input("APPLE"))   // true
console.log(valid_input("AP"))      // false
console.log(valid_input("TOOLONG")) // false

// ─── is_solved ─────────────────────────────────────────────────
console.log("\n=== is_solved ===")
console.log(is_solved("APPLE", "APPLE")) // true
console.log(is_solved("CRANE", "APPLE")) // false

// ─── evaluate_guess ────────────────────────────────────────────
console.log("\n=== evaluate_guess ===")

// All correct
console.log("All correct:")
console.log(evaluate_guess("APPLE", "APPLE").word.map(t => `${t.letter}:${t.state}`))
// A:correct P:correct P:correct L:correct E:correct

// All absent
console.log("All absent:")
console.log(evaluate_guess("CRANE", "PILOT").word.map(t => `${t.letter}:${t.state}`))
// C:wrong R:wrong A:wrong N:wrong E:wrong

// Mix of present/correct/absent
console.log("Mix (PAPEL vs APPLE):")
console.log(evaluate_guess("PAPEL", "APPLE").word.map(t => `${t.letter}:${t.state}`))
// P:present A:present P:correct E:present L:present

// Duplicate letters
console.log("Duplicates (SPEED vs ABIDE):")
console.log(evaluate_guess("SPEED", "ABIDE").word.map(t => `${t.letter}:${t.state}`))
// S:wrong P:wrong E:present E:wrong D:present
// only 1 E should be present, not both

// ─── get_game_state ────────────────────────────────────────────
console.log("\n=== get_game_state ===")

const answer = "APPLE"

// No guesses yet
console.log(get_game_state([], answer)) // waiting

// One wrong guess
const guess1 = evaluate_guess("CRANE", answer)
console.log(get_game_state([guess1], answer)) // playing

// Correct guess
const guess2 = evaluate_guess("APPLE", answer)
console.log(get_game_state([guess1, guess2], answer)) // solved

// Max tries reached without solving
const wrongGuess = evaluate_guess("CRANE", answer)
const sixWrongGuesses = Array(6).fill(wrongGuess)
console.log(get_game_state(sixWrongGuesses, answer)) // failed


console.log("\n=== get_random_word ===")
console.log(get_random_word()) // random 5-letter word in uppercase

console.log("\n=== is_valid_word ===")
console.log(is_valid_word("APPLE")) // true
console.log(is_valid_word("XZQKJ")) // false
