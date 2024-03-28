/**
 * A generator function that decodes and yields each
 * line from a given ReadableStream without unnecessary
 * memory consumption by avoiding concatenation of large chunks.
 * @param {ReadableStreamDefaultReader} reader - The stream reader obtained from a fetch response body.
 */
export default async function* forEachLine(reader) {
  const decoder = new TextDecoder(`utf-8`)
  let partialLine = ""

  while (true) {
    // Read from the stream
    const { done, value } = await reader.read()
    if (done) {
      // If there's any remaining text in the partial line, yield it as the last line.
      if (partialLine.length > 0) {
        yield partialLine
        partialLine = ""
      }
      break
    }

    // Decode the current chunk
    const chunk = decoder.decode(value, { stream: true })
    let start = 0,
      end = 0

    while ((end = chunk.indexOf("\n", start)) >= 0) {
      // Combine the partial line with the current segment up to the newline and yield
      yield partialLine + chunk.substring(start, end)
      // Reset partial line and adjust start position
      partialLine = ""
      start = end + 1
    }

    // After processing all lines in the current chunk, any remaining text is a partial line
    partialLine += chunk.substring(start)
  }
}
