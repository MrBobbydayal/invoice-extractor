import axios from "axios";
import fs from "fs";

function detectFileType(buffer) {
  // PDF: starts with "%PDF"
  if (buffer.slice(0, 4).toString() === "%PDF") return ".pdf";

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47)
    return ".png";

  // JPG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF)
    return ".jpg";

  // WEBP: "RIFF" + ... + "WEBP"
  if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP")
    return ".webp";

  return ""; // Unknown
}

export async function downloadFile(url, basePath) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    maxRedirects: 5,
    validateStatus: () => true,
  });

  if (!response || !response.data) {
    throw new Error("Failed to download file");
  }

  const buffer = Buffer.from(response.data);
  const contentType = (response.headers["content-type"] || "").toLowerCase();

  let ext = "";

  // Case 1: Known content-types
  if (contentType.includes("pdf")) ext = ".pdf";
  else if (contentType.includes("png")) ext = ".png";
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = ".jpg";
  else if (contentType.includes("webp")) ext = ".webp";

  // Case 2: application/octet-stream → detect by magic bytes
  if (contentType.includes("application/octet-stream") || ext === "") {
    const detected = detectFileType(buffer);
    if (detected) ext = detected;
  }

  if (!ext) {
    throw new Error("Unsupported file type: " + contentType);
  }

  const filePath = basePath + ext;
  fs.writeFileSync(filePath, buffer);

  return { filePath, ext };
}






//older
// import fs from "fs";
// import axios from "axios";

// export async function downloadFile(url, localPath) {
//   const writer = fs.createWriteStream(localPath);

//   const response = await axios({
//     url,
//     method: "GET",
//     responseType: "stream",
//     timeout: 30000,
//   });

//   return new Promise((resolve, reject) => {
//     response.data.pipe(writer);
//     let error = null;
//     writer.on("error", (err) => {
//       error = err;
//       writer.close();
//       reject(err);
//     });
//     writer.on("close", () => {
//       if (!error) resolve(localPath);
//     });
//   });
// }


//oldest

// import fs from "fs";
// import axios from "axios";
// import AWS from "aws-sdk";

// const S3 = new AWS.S3({ region: process.env.AWS_REGION });

// export async function downloadFile(url, dest) {
//   const writer = fs.createWriteStream(dest);
//   const response = await axios({ url, method: "GET", responseType: "stream" });

//   response.data.pipe(writer);

//   return new Promise((resolve, reject) => {
//     writer.on("finish", resolve);
//     writer.on("error", reject);
//   });
// }

// export async function uploadToS3(localFile, bucket, key) {
//   const fileData = fs.readFileSync(localFile);
//   await S3.putObject({ Bucket: bucket, Key: key, Body: fileData }).promise();
//   return `s3://${bucket}/${key}`;
// }
