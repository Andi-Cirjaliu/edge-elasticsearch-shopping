const { Client } = require('@elastic/elasticsearch')
const defaultItems = require('./default_shopping_items');
const SHOPPING_INDEX = 'shopping';

const io = require('./socket');

const host = process.env.DB_HOST || 'http://localhost:9200';
const secure = process.env.DB_SECURE || false;
const user = process.env.DB_USER || 'elastic';
const password = process.env.DB_PASSWORD || '';
const useSSL = process.env.DB_USE_SSL || false;
const SSLCert = process.env.DB_SSL_CERT || '';
console.log('db host: ', host, ', secure: ', secure, ', user: ', user, ', useSSL: ', useSSL, ', SSLCert: ', SSLCert);

let db_init = false;

let connectionInfo = {
  node: host
};

if ( secure === 'true' ) {
  connectionInfo.auth = {
    username: user,
    password: password
  }
}
if ( useSSL === 'true' ){
  connectionInfo.ssl = {
    ca: SSLCert,
    rejectUnauthorized: false
  }
}
// console.log('connection info: ', connectionInfo);
console.log("Created an elastic search client for host ", host);

const client = new Client(connectionInfo);
// if (host) {
//   console.log("Created an elastic search client for host ", host);
//   client = new Client({
//     node: host,
//     // maxRetries: 3,
//     // requestTimeout: 30000,
//     // sniffOnStart: true,
//   });
// } else {
//   console.log("Created an elastic search client for http://localhost:9200 ");
// } 

// client.ping(
//   {
//     // ping usually has a 3000ms timeout
//     requestTimeout: Infinity,
//     // undocumented params are appended to the query string
//     hello: "elasticsearch!",
//   },
//   function (error) {
//     if (error) {
//       console.log(error);
//       console.trace("Ping to elasticsearch cluster failed!");
//     } else {
//       console.log("Ping was successful!");
//     }
//   }
// );

// console.log('Elastic search client:', client);

const getAllItems = async () => {
  if ( db_init === false ) {
    await initDB();
  }

  console.log("get all items...");

  const { body } = await client.search(
    {
      index: SHOPPING_INDEX,
      sort : "_source.itemName:asc",
      body: {
        query: {
          match_all: {},
        },
      },
      sort : "itemName:asc",
      size: 100
    }
  );

  // console.log(" all items found: ", body);

  const allValues = body.hits.hits.map((hit) => {
    // console.log(hit);
    return {
      id: hit._id,
      itemName: hit._source.itemName,
      itemQty: hit._source.itemQty,
    };
  });
  console.log("all items:", allValues);

  return allValues;
};

const getItem = async (key) => {
  console.log("get item ", key);

  try {
    const { body } = await client.get({
      index: SHOPPING_INDEX,
      id: key,
    });

    // console.log(key, " is ", body._source);
    const item = { id: body._id, ...body._source };

    console.log('item ', key, " is ", item);

    return item;
  } catch (err) {
    console.log("An error occured when reading item ", key, ": ", err);
    throw err;
  }
};

const existsItem = async (itemName) => {
  console.log("check if item ", itemName, " exists.");

  const {body} = await client.search({
    index: SHOPPING_INDEX,
    body: {
      query: {
        match: {
          itemName: itemName
        }
      }
    },
  });

  console.log(" all items found count: ", body.hits.total.value);
  // console.log(" all items found: ", body.hits.hits);

  const found = body.hits.total.value > 0 || body.hits.hits.length > 0;
  console.log("item ", itemName, " exists: ", found);

  return found;
};

const addItem = async (itemName, itemQty) => {
  console.log("add ", itemName, " with qty ", itemQty);

  const {body} = await client.index({
    index: SHOPPING_INDEX,
    body: {
      itemName,
      itemQty,
    },
    refresh: true
  });

  // console.log(body);
  console.log('new item: ', body._id);

  //send event to clients
  io.getIO().emit("change", { action: "add", key: body._id, value: itemQty });

};

const updateItem = async (id, itemQty) => {
  console.log("set item ", id, " to qty ", itemQty);

  const {body} = await client.update({
    index: SHOPPING_INDEX,
    id: id,
    body: {
      doc: {
        itemQty: itemQty,
      },
    },
    refresh: true
  });

  // console.log(body);
  console.log('Updated item ', id, " to qty ", itemQty);

  //send event to clients
  io.getIO().emit("change", { action: "update", key: id, value: itemQty });
};

const deleteItem = async (id, itemQty) => {
  console.log("delete item ", id);

  const {body} = await client.delete({
    index: SHOPPING_INDEX,
    id: id,
    refresh: true
  });

  //send event to clients
  io.getIO().emit("change", { action: "delete", id });

  // console.log(res);
  console.log('Deleted item ', id);

  // return res;
};

const initDB = async () => {
  console.log("Init DB....");

  if (!defaultItems || defaultItems.length === 0) {
    return;
  }

  //create index
  try {
    await client.indices.create({
      index: SHOPPING_INDEX,
    });
  } catch (err) {
    console.log("failed to create the index. error: ", err);
  }

  let exists;
  try {
    for (item of defaultItems) {
      exists = await existsItem(item.itemName);
      if (exists === false) {
        await addItem(item.itemName, item.itemQty);
      }
    }

    //update meta
    try {
      await client.indices.putMapping({
        index: SHOPPING_INDEX,
        body: {
          properties: {
            itemName: {
              type: "text",
              fielddata: true,
            },
          },
        },
      });
    } catch (err) {
      console.log("failed to create the index. error: ", err);
    }
  } catch (err) {
    console.error("An error occured while initialize elastic search db: ", err);
  }

  io.getIO().emit("change", { action: "init" });

  db_init = true;
};

module.exports = {
    initDB,
    getAllItems,
    getItem,
    existsItem,
    addItem,
    updateItem,
    deleteItem
}

// (async () => {

// })();

// getAllItems();
// getItem('2');
// addItem('kiwis', 2);
// updateItem(2, 7);
// deleteItem('uL5MAXcBwiC_gzya--PE');
// deleteItem('ub5MAXcBwiC_gzya--Pp');
// deleteItem('ur5MAXcBwiC_gzya_OML');
// deleteItem(1);
// existsItem('apples');
// initDB();
