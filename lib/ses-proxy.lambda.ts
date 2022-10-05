var AWS = require("aws-sdk");
var s3 = new AWS.S3();

var bucketName = "<YOUR BUCKET GOES HERE>";

exports.handler = function (event: any, context: any, callback: any) {
  console.log("Process email");

  var sesNotification = event.Records[0].ses;
  console.log("SES Notification:\n", JSON.stringify(sesNotification, null, 2));

  // Retrieve the email from your bucket
  s3.getObject(
    {
      Bucket: bucketName,
      Key: sesNotification.mail.messageId,
    },
    function (err:Error, data: any) {
      if (err) {
        console.log(err, err.stack);
        callback(err);
      } else {
        console.log("Raw email:\n" + data.Body);

        // Custom email processing goes here

        callback(null, null);
      }
    }
  );
};
