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
  // Code Review 2017-07-29: Traverse tuning, do not store entire blockchain data
  traversData(finishCallback, iterCallback, errCallback) {
    let i = 0;
    db.createReadStream().on('data', function(data) {
          i++;
          if (iterCallback) {
            iterCallback(JSON.parse(data.value));
          }
        }).on('error', function(err) {
          console.log('Unable to read data stream!', err)
          if (errCallback) {
            errCallback(err);
          }
        }).on('close', function() {
          if (finishCallback) {
            finishCallback(i);
          }
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
    this.level.traversData(function(height) {
      if (height == 0) {
        console.log("Adding genesis block");
        blockchain.addBlock(new Block("First Block - Genesis"), function(result) {
          if (callback) {
            callback(1);
          }
        });
      } else {
        if (callback) {
          callback(height);
        }
      }
    });
  }

  // Add new block
  addBlock(newBlock, callback){
    console.log("Adding new block");
    let level = this.level;
    this.level.traversData(function(height) {
      // Block height
      newBlock.height = height;
      // UTC timestamp
      newBlock.time = new Date().getTime().toString().slice(0,-3);
      // previous block hash
      if(height > 0){
        level.getLevelDBData(height - 1, function(block) {
          newBlock.previousBlockHash = block.hash;
          // Block hash with SHA256 using newBlock and converting to a string
          newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
          // Adding block object to chain
          level.addLevelDBData(newBlock.height, newBlock, callback);
        })
      } else {
        // Block hash with SHA256 using newBlock and converting to a string
        newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
        // Adding block object to chain
        level.addLevelDBData(newBlock.height, newBlock, callback);
      }
    });

  }

  // Get block height
  getBlockHeight(callback){
    this.level.traversData(function(height) {
      callback(height - 1);
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
  // Code review 2018-07-29: Tuning for the chain loop and validation
  validateChain(){
    let blockchain = this;
    let errorLog = [];
    let traverseLength = 0;
    
    this.level.traversData(function(height) {
      if (errorLog.length>0) {
        console.log('Block errors = ' + errorLog.length);
        console.log('Blocks: '+errorLog);
      } else {
        console.log('No errors detected');
      }
    }, function(block){
      if (!blockchain.validateBlockData(block))errorLog.push(i);

      if (block.height > 0) {
        // compare blocks hash link
        blockchain.getBlock(block.height - 1, function(lastBlock){
          let blockPrevHash = block.previousBlockHash;
          let previousHash = lastBlock.hash;
          if (blockPrevHash!==previousHash) {
            errorLog.push(block.height);
          }
        });
      }
    });
  }
}

let blockchain = new Blockchain(function(height) {

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