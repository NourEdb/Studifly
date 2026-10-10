// Trims text back to its last complete sentence (ending in . ! or ?). Used
// when a model reply was cut off by the token budget, so the user sees a
// full thought instead of a word sliced mid-way through.
function trimToLastSentence(text) {
  const matches = [...text.matchAll(/[.!?](?=\s|$)/g)];
  if (matches.length === 0) return text;
  const last = matches[matches.length - 1];
  return text.slice(0, last.index + 1).trim();
}

// Call with a Groq chat completion's message content + finish_reason. Only
// trims when the reply was actually cut off by the length limit
// (finish_reason === 'length') — a normal, complete reply (finish_reason
// === 'stop') is returned untouched.
function finalizeCompletion(text, finishReason) {
  return finishReason === 'length' ? trimToLastSentence(text) : text;
}

module.exports = { trimToLastSentence, finalizeCompletion };
