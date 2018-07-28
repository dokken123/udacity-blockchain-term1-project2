/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

const SHA256 = require('crypto-js/sha256');
const util = require('util')

const level = require('level');
const chainDB = './chaindata';
const db = level(chainDB);


/* ===== BlockLevelDB Class =======================
|  LevelDB operation for block chain       			 |
|  ===============================================*/
class BlockLevelDB {
  // Add data to levelDB with key/value pair
  addLevelDBData(key,value, callback, errCallback){
    db.put(key, JSON.stringify(value), function(err) {
      if (err) {
        console.log('Block ' + key + ' submission failed', err);
        if (errCallback) {
          callback(err);
        }
      };
      if (callback) {
        callback(true);
      }
    })
  }
  
  // Get data from levelDB with key and callback value
  getLevelDBData(key, callback, errCallback) {
    db.get(key, function(err, value) {
      if (!err) {
        callback(JSON.parse(value));
      } else {
        console.log('err got when getting data: ', err)
        if (errCallback) {
          errCallback(err);
        }
      }
    });
  }

  // Traverse data of entire blockchain
  traversBlockChainData(finishCallback, errCallback) {
    let i = 0;
    let chain = [];
    db.createReadStream().on('data', function(data) {
          i++;
          chain.push(JSON.parse(data.value));
        }).on('error', function(err) {
          console.log('Unable to read data stream!', err)
          errCallback(err);
        }).on('close', function() {
          finishCallback(chain);
        });
  }

}

/* ===== Block Class ==============================
|  Class with a constructor for block 			   |
|  ===============================================*/

class Block{
	constructor(data){
     this.hash = "",
     this.height = 0,
     this.body = data,
     this.time = 0,
     this.previousBlockHash = ""
    }
}

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

class Blockchain{
  constructor(callback){
    console.log("initializing");
    this.level = new BlockLevelDB();
    // preserve BlockChain instance for closure
    let blockchain = this;
    // initialize blockchain data and add genesis block if not exists
    this.level.traversBlockChainData(function(chain) {
      if (chain.length == 0) {
        console.log("Adding genesis block");
        blockchain.addBlock(new Block("First Block - Genesis"), function(result) {
          if (callback) {
            callback(chain);
          }
        });
      } else {
        if (callback) {
          callback(chain);
        }
      }
    }, function(err) {
      console.log("error caught when filling block data");
    });
  }

  // Add new block
  addBlock(newBlock, callback){
    console.log("Adding new block");
    let level = this.level;
    this.level.traversBlockChainData(function(chain) {
      // Block height
      newBlock.height = chain.length;
      // UTC timestamp
      newBlock.time = new Date().getTime().toString().slice(0,-3);
      // previous block hash
      if(chain.length>0){
        newBlock.previousBlockHash = chain[chain.length-1].hash;
      }
      // Block hash with SHA256 using newBlock and converting to a string
      newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
      // Adding block object to chain
      level.addLevelDBData(newBlock.height, newBlock, callback);
    }, function(err) {
      console.log("error caught when filling block data");
    });

  }

  // Get block height
  getBlockHeight(callback){
    let chain = [];
    this.level.traversBlockChainData(function(chain) {
      callback(chain.length - 1);
    }, function(err) {
      console.log("error caught when filling block data");
    });
  }

  // get block
  getBlock(blockHeight, callback){
    // return object as a single string
    this.level.getLevelDBData(blockHeight, function(block) {
      callback(block);
    });
  }

  // validate block by height
  validateBlock(blockHeight, callback){
    // get block object
    let blockchain = this;
    this.getBlock(blockHeight, function(block) {
      callback(blockchain.validateBlockData(block));
    });
  }

  // validate block data
  validateBlockData(block){
    // get block hash
    let blockHash = block.hash;
    // remove block hash to test block integrity
    block.hash = '';
    // generate block hash
    let validBlockHash = SHA256(JSON.stringify(block)).toString();
    // assign hash back to block
    block.hash = blockHash;
    // Compare
    if (blockHash===validBlockHash) {
      return true;
    } else {
      console.log('Block #'+block.height+' invalid hash:\n'+blockHash+'<>'+validBlockHash);
      return false;
    }
  }

  // Validate blockchain
  validateChain(){
    let blockchain = this;
    this.level.traversBlockChainData(function(chain) {
      let errorLog = [];
      for (var i = 0; i < chain.length-1; i++) {
        var block = chain[i];
        // validate block
        if (!blockchain.validateBlockData(block))errorLog.push(i);
        // compare blocks hash link
        let blockHash = chain[i].hash;
        let previousHash = chain[i+1].previousBlockHash;
        if (blockHash!==previousHash) {
          errorLog.push(i);
        }
      }
      if (errorLog.length>0) {
        console.log('Block errors = ' + errorLog.length);
        console.log('Blocks: '+errorLog);
      } else {
        console.log('No errors detected');
      }
    }, function(err) {
      console.log("error caught when filling block data");
    });
  }
}

let blockchain = new Blockchain(function(chain) {

  // Get Genesis block
  console.log("1. Get genesis block data");
  blockchain.getBlock(0, function(block) {
    console.log(JSON.stringify(block));
    
    // add new Block
    console.log("2. Add new block");
    blockchain.addBlock(new Block("New test block at " + new Date().toString()), function(result) {
      
      let blockHeight = 0;
      // get block height
      console.log("3. Get current block height");
      blockchain.getBlockHeight(function(height) {
        blockHeight = height;
        console.log("blockchain height: " + blockHeight);
        // validate last block
        console.log("4. Validate block at " + blockHeight);
        blockchain.validateBlock(blockHeight, function(result) {
          console.log(util.format("Block at %s validate status: %s", blockHeight, result));
          // get last block data
          console.log("5. Get block data at " + blockHeight);
          blockchain.getBlock(blockHeight, function(block) {
            console.log("Block at " + blockHeight + ": " + JSON.stringify(block));
            // Validate blockchain
            console.log("6. Validate entire block chain");
            blockchain.validateChain();
          });
        });
      });
    });
  });
});