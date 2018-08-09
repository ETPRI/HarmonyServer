var config = {}

// talk to cosmos-db
config.gremlin = {};
config.gremlin.endpoint = "murduk.gremlin.cosmosdb.azure.com";
config.gremlin.primaryKey = "BSGbfbwdycuuB7R79lyz6UA35bBJ9SW7hy1AT1Mrt5my92BfU5nsXw80GoQwF7EDX5pt53QViX1KoldXr9OIaQ==";
config.gremlin.database = "graphdb"
config.gremlin.collection = "Persons"

// talk to neo4j, assume it is a localhost
config.neo4j = {};
config.neo4j.password  = "paleo3i";

// default server file
config.defaultFile = "/index.html";


module.exports = config;
