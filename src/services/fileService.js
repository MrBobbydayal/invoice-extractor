
import fs from "fs";
import axios from "axios";

export async function downloadFile(url, localPath) {
  const writer = fs.createWriteStream(localPath);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    timeout: 30000,
  });

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    let error = null;
    writer.on("error", (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on("close", () => {
      if (!error) resolve(localPath);
    });
  });
}




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
