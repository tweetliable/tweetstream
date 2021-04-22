// load env variables
require("dotenv").config();

const needle = require("needle");
const logger = require("./config/logger");

const token = process.env.BEARER_TOKEN;

const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL = "https://api.twitter.com/2/tweets/search/stream";

const rules = [
  {
    value:
      "from:IrrawaddyNews OR from:Myanmar_Now_Eng OR from:dvbburmese OR from:MizzimaNews OR from:Khithitofficial OR from:RFABurmese",
  },
];

// get rules
async function getAllRules() {
  const response = await needle("get", rulesURL, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (response.statusCode !== 200) {
    logger.error(`${response.statusCode} - ${response.statusMessage}`);
    throw new Error(response.body);
  }

  return response.body;
}

// delete the passed rules
async function deleteAllRules(rules) {
  if (!Array.isArray(rules.data)) {
    return null;
  }

  const ids = rules.data.map((rule) => rule.id);

  const data = {
    delete: {
      ids: ids,
    },
  };

  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(response.body);
  }

  return response.body;
}

// set new rules
async function setRules() {
  const data = {
    add: rules,
  };

  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(response.body);
  }

  return response.body;
}

// transmit data to api
async function storeData(payload) {
  try {
    await needle("post", `${process.env.API}`, payload, {
      headers: {
        "content-type": "application/json",
        authorization: `${process.env.SECRET}`,
      },
    });
  } catch (err) {
    logger.error(`${err.statusCode} - ${err.body}`);
  }
}

// connect to stream
function streamConnect(retryAttempt) {
  const stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 20000,
  });

  stream
    .on("data", (data) => {
      try {
        const json = JSON.parse(data);
        logger.info(json);

        let payload = {
          id: json.data.id,
          text: json.data.text,
        };

        storeData(payload);

        //successful connection resets retry count.
        retryAttempt = 0;
      } catch (err) {
        if (
          data.detail ===
          "This stream is currently at the maximum allowed connection limit."
        ) {
          logger.error(data.detail);
          process.exit(1);
        } else {
          // Keep alive signal received. Do nothing
        }
      }
    })
    .on("err", (error) => {
      if (error.code !== "ECONNRESET") {
        logger.error(error.code);
        proess.exit(1);
      } else {
        setTimeout(() => {
          logger.warn("A connection error occurred. Reconnecting...");
          streamConnect(++retryAttempt);
        }, 2 ** retryAttempt);
      }
    });

  return stream;
}

(async () => {
  // can comment out if no need to touch rules
  // let currentRules;
  // try {
  //   // Gets the complete list of rules currently applied to the stream
  //   currentRules = await getAllRules();
  //   // Delete all rules.
  //   await deleteAllRules(currentRules);
  //   // Set new rules
  //   await setRules();
  // } catch (err) {
  //   logger.error(err);
  //   process.exit(1);
  // }

  // Listen to the stream
  streamConnect(0);
})();
