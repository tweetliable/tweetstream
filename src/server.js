// load env variables
require("dotenv").config();

const needle = require("needle");

const token = process.env.BEARER_TOKEN;

const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL = "https://api.twitter.com/2/tweets/search/stream";

const rules = [
  {
    value:
      "from:IrrawaddyNews OR from:Myanmar_Now_Eng OR from:Voaburmese OR from:MizzimaNews OR from:RFABurmese",
  },
];

async function getAllRules() {
  const response = await needle("get", rulesURL, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (response.statusCode !== 200) {
    console.log("Error: ", response.statusMessage, response.statusCode);
    throw new Error(response.body);
  }

  return response.body;
}

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

function streamConnect(retryAttempt) {
  const stream = needle.get(streamURL, {
    headers: {
      // "User-Agent": "v2FilterStreamJS",
      Authorization: `Bearer ${token}`,
    },
    timeout: 20000,
  });

  stream
    .on("data", (data) => {
      try {
        const json = JSON.parse(data);
        console.log(json);

        let data = {
          id: json.data.id,
          text: json.data.text,
        };
        needle("post", `${process.env.API}`, data, {
          headers: {
            "content-type": "application/json",
            authorization: `${process.env.SECRET}`,
          },
        })
          .then((res) => console.log(res))
          .catch((err) => console.log(err));

        //successful connection resets retry count.
        retryAttempt = 0;
      } catch (e) {
        if (
          data.detail ===
          "This stream is currently at the maximum allowed connection limit."
        ) {
          console.log(data.detail);
          process.exit(1);
        } else {
          // Do nothing
        }
      }
    })
    .on("err", (error) => {
      if (error.code !== "ECONNRESET") {
        console.log(error.code);
        proess.exit(1);
      } else {
        setTimeout(() => {
          console.warn("A connection error occurred. Reconnecting...");
          streamConnect(++retryAttempt);
        }, 2 ** retryAttempt);
      }
    });

  return stream;
}

(async () => {
  let currentRules;
  try {
    // Gets the complete list of rules currently applied to the stream
    currentRules = await getAllRules();
    // Delete all rules.
    await deleteAllRules(currentRules);
    // Set new rules
    await setRules();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  // Listen to the stream
  streamConnect(0);
})();
