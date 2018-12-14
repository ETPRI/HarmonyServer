var config = {};

config.port = 8081;   // 8080 -> production, 8081 -> beta

// where files are downloaded, their is a direcgtory for each GUID user
config.servedDirectory    = "servedFiles";  // all served files are subdirectory in this
config.defaultAppDirectory = "/appHarmony";        // subdirectory that defaul app is servered from
                                          // assume app.html lives there

//config.userFiles = "servedFiles/userFiles";  // user download driectory
config.userFiles = "/userDownloads";  // user download driectory

// neo4j graph database paramers
config.neo4j = {};
config.neo4j.password = "paleo3i";
config.neo4jBackup = "backups/Neo4j";  // backup and restore should be indepenant of backend db, make a

// export server config to nodejs
module.exports = config;

config.timerDurationMS = 30*60*1000; // minutes * 60s/m * 1000ms/s; usually 30 minutes; 1 when testing


/// depricated infig info to be deleted in future


// used for cosmo-db
// config.endpoint = "murduk.gremlin.cosmosdb.azure.com";
// config.primaryKey = "BSGbfbwdycuuB7R79lyz6UA35bBJ9SW7hy1AT1Mrt5my92BfU5nsXw80GoQwF7EDX5pt53QViX1KoldXr9OIaQ==";
// config.database = "graphdb";
// config.collection = "Persons";
