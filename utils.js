
/**
 * Normalizes a word for comparison by:
 * 1. Converting to lower case
 * 2. Replacing curly apostrophes with straight ones
 * 3. Removing all non-alphanumeric characters
 * 4. Trimming whitespace
 */
function normalizeWord(word) {
    if (!word) return "";
    return word
        .toLowerCase()
        .replace(/[’‘]/g, "'") // Normalize apostrophes
        .replace(/[^a-z0-9]/g, "") // Strip everything except letters and numbers
        .trim();
}

module.exports = {
    normalizeWord
};
