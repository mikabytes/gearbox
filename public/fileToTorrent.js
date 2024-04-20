import * as bencode from "./bencode.js"

export default function fileToTorrent(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file provided"))
      return
    }

    let reader = new FileReader()

    // Handle FileReader errors
    reader.onerror = () => {
      reject(new Error("Error reading the file"))
    }

    reader.onloadend = () => {
      try {
        // Access the ArrayBuffer from the FileReader
        const binaryString = reader.result
        const decodedData = bencode.decode(binaryString)

        if (!decodedData.info) {
          console.log(decodedData)
          reject(new Error("Invalid torrent info"))
        }

        if (!decodedData.info.name) {
          console.log(decodedData)
          reject(new Error("Invalid torrent name"))
        }

        const base64 = btoa(binaryString)
        resolve({
          fileName: file.name,
          name: decodedData.info.name,
          files: !decodedData.info.files?.length
            ? [
                // single torrent
                {
                  path: [decodedData.info.name],
                  length: decodedData.info.length,
                },
              ]
            : decodedData.info.files,
          data: base64,
        })
      } catch (error) {
        reject(new Error("Failed to decode the file"))
      }
    }

    // Initiate reading the file
    reader.readAsBinaryString(file)
  })
}
