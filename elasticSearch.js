const { Client } = require('@elastic/elasticsearch')
const defaultItems = require('./default_shopping_items');
const SHOPPING_INDEX = 'shopping';

const io = require('./socket');

const host = process.env.DB_HOST;
console.log('db host: ', host);


let client = new Client({ node: 'http://localhost:9200' });
if ( host ) {
  client = new Client({ node: host });
} 
console.log('Created an elastic search client for host ', host);

const getAllItems = async () => {
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

  console.log(" all items found: ", body);

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

  console.log(body);
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
    console.log('Init DB....');

    if ( ! defaultItems || defaultItems.length === 0  ) {
        return;
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
      client.indices.putMapping({
        index: SHOPPING_INDEX,
        body: {
          "properties": {
            "itemName": { 
              "type":     "text",
              "fielddata": true
            }
          }
        }
      })
    } catch (err) { 
      console.error("An error occured while initialize elastic search db: ", err);
    }

    io.getIO().emit("change", { action: "init" });
}


// const watchKeyChanges = (key) => {
//     console.log('Watch changes for ', key);
//     client
//       .watch()
//       .key(key)
//       .create()
//       .then((watcher) => {
//         watcher
//           .on("disconnected", () => 
//             console.log("watcher disconnected...")
//             )
//           .on("connected", () =>
//             console.log("successfully reconnected watcher!")
//           )
//           .on("put", (res) => {
//             let value = res.value.toString();
//             console.log('PUT EVENT - ', key, " got set to:", value);
//             //emit event
//             io.getIO().emit("change", { action: "update", key, value });
//           })
//           .on("delete", (res) => { 
//               console.log('DELETE EVENT - ', key, " was deleted");
//               //emit event
//             io.getIO().emit("change", { action: "delete", key, value: null });
//         });
//       });
// }

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
//   await client.put('foo').value('bar');

//   await client.put('msg2').value('test msg2');
 
//   const fooValue = await client.get('foo').string();
//   console.log('foo was:', fooValue);
 
//   const allFValues = await client.getAll().prefix('f').keys();
//   console.log('all our keys starting with "f":', allFValues);

//   const allFValues2 = await client.getAll().keys();
//   console.log('all our keys:', allFValues2);

//   const allFValues2Str = await client.getAll().strings();
//   console.log('all our keys as text:', allFValues2Str);

//   const allFValues2Json = await client.getAll().json;
//   console.log('all our keys as JSON:', allFValues2Json);
 
// //   await client.delete().all();
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
