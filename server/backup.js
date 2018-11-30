module.exports = class backup {
  constructor(config, fs, driver, stringEscape) {
    this.config = config;
    this.fs = fs;
    this.driver = driver;
    this.stringEscape = stringEscape;
    this.finalPath = "";
    this.nodeFiles = 1;
    this.relFiles = 1;
    this.restoreFolder = "";
    this.restorePath = "";
  }

  processBackup(query, response) {
    if (query.functionName === "findNodes" || query.functionName === "startRestore") { // If starting a new process, reset variables
      this.nodeFiles = 1; // reset to defaults
      this.relFiles = 1;
    }

    if (query.functionName in this) {
      this[query.functionName](query, response);
    }
    else {
      console.log("Error: function '%s' is not a backup function\n", query.functionName);
    }
  }

  findNodes(query, response) {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const basePath = `${this.config.neo4jBackup}/${todayString}`;
    this.finalPath = basePath; // reset just in case it's been changed

    let number = 2;

    while (this.fs.existsSync(this.finalPath)) {
      this.finalPath = `${basePath}(${number})`;
      number++;
    }

    const backup = this;

    this.fs.mkdir(`${this.finalPath}`, function(err) {
      if (err) {
        console.log(err);
      }
      else {
        backup.finishFindNodes(query, response);
      }
    });
  }

  finishFindNodes(query, response) {
    var nodesDone = [];
    var data = [];

    console.log('Backup Neo4j - finding nodes');

    if (query === 'server:exit') {
        // stop the node server
        this.driver.close();
        process.exit(0);
        return;
    }

    const session = this.driver.session();
    const startQuery = "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count";
    const backup = this;

    session
      .run(startQuery)
      .subscribe({
        onNext: function (record) {
          const obj={};
          for (let i=0; i< record.length; i++) {
            obj[record.keys[i]]=record._fields[i];
          }
          data.push(obj);
          console.log("%s/n",JSON.stringify(obj));
        },
        onCompleted: function () {
          // organize results into array
          for (let i = 0; i < data.length; i++) {
            nodesDone[i] = {};
            nodesDone[i].name = data[i].L;
            nodesDone[i].target = data[i].count.low;
          }
          nodesDone.sort(function(a,b) {
            return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
          });
          backup.fs.appendFile(`${backup.finalPath}/nodeMetaData.txt`, JSON.stringify(nodesDone), (err) => {
            if (err) throw err;
          });

          response.end(JSON.stringify(nodesDone));
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  findRels(query, response) {
    var data = [];
    var relsDone = [];

    console.log('Backup Neo4j - finding relations');

    if (query === 'server:exit') {
        // stop the node server
        this.driver.close();
        process.exit(0);
        return;
    }

    const session = this.driver.session();
    const startQuery = "MATCH (a)-[r]->(b) return distinct type(r) as type, count(r) as count order by type";
    const backup = this;

    session
      .run(startQuery)
      .subscribe({
        onNext: function (record) {
        const obj={};
      for (let i=0; i< record.length; i++) {
        obj[record.keys[i]]=record._fields[i];
        }
        data.push(obj);
          console.log("%s/n",JSON.stringify(obj));
        },
        onCompleted: function () {
          // organize results into array
          for (let i = 0; i < data.length; i++) {
            relsDone[i] = {};
            relsDone[i].name = data[i].type;
            relsDone[i].target = data[i].count.low;
          }
          relsDone.sort(function(a,b) {
            return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
          });
          backup.fs.appendFile(`${backup.finalPath}/relMetaData.txt`, JSON.stringify(relsDone), (err) => {
            if (err) throw err;
          });

          response.end(JSON.stringify(relsDone));
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  backupNodes(query, response) {
    console.log('Backup Neo4j - backing up nodes');

    if (query === 'server:exit') {
        // stop the node server
        this.driver.close();
        process.exit(0);
        return;
    }

    const session = this.driver.session();
    const backup = this;

    let where = "";
    if (query.minimum !== 0) {
      where = `where n.M_GUID > '${query.minimum}'`;
    }

    const backupQuery = `match (n: ${query.name}) ${where} return n order by n.M_GUID limit ${query.blocksize}`;
    let data = [];

    session
      .run(backupQuery)
      .subscribe({
        onNext: function (record) {
          let currentObj = {};
          for (let i=0; i< record.length; i++) {
            currentObj[record.keys[i]]=record._fields[i];
          }
          delete currentObj.n.identity;
          // try to order the object
          const keys = Object.keys(currentObj.n.properties);
          keys.sort();
          const newObj = {};
          newObj.n = {};
          newObj.n.labels = currentObj.n.labels; // Leave everything except the individual properties the same
          newObj.n.properties = {};
          for (let i = 0; i < keys.length; i++) {
            newObj.n.properties[keys[i]] = currentObj.n.properties[keys[i]]; // Put properties back in alphabetical order
          }
          data.push(newObj);

          console.log("%s/n",JSON.stringify(newObj));
        },
        onCompleted: function () {
          // store data
          backup.fs.appendFile(`${backup.finalPath}/nodes_${backup.nodeFiles++}.txt`, JSON.stringify(data), (err) => {
            if (err) throw err;
          });

          // send progress back to client
          const lastID = data[data.length-1].n.properties.M_GUID;
          const update = {"numNodes":data.length, "lastID":lastID};
          response.end(JSON.stringify(update));
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  backupRels(query, response) {
    console.log('Backup Neo4j - backing up relations');

    if (query === 'server:exit') {
        // stop the node server
        this.driver.close();
        process.exit(0);
        return;
    }

    const session = this.driver.session();

    let where = "";
    if (query.minimum !== 0) {
      where = `where r.M_GUID > '${query.minimum}'`;
    }
    const backupQuery = `match (a)-[r:${query.name}]->(b) ${where} return a.M_GUID as a, b.M_GUID as b, r order by r.M_GUID limit ${query.blocksize}`;
    let data = [];
    const backup = this;

    session
      .run(backupQuery)
      .subscribe({
        onNext: function (record) {
          let currentObj = {};
          for (let i=0; i< record.length; i++) {
            currentObj[record.keys[i]]=record._fields[i];
          }
          delete currentObj.r.identity;
          delete currentObj.r.start;
          delete currentObj.r.end;

          // try to order the object
          const keys = Object.keys(currentObj.r.properties);
          keys.sort();
          const newObj = {};
          newObj.a = currentObj.a;
          newObj.b = currentObj.b;
          newObj.r = {};
          newObj.r.type = currentObj.r.type; // Leave everything except the individual properties the same
          newObj.r.properties = {};
          for (let i = 0; i < keys.length; i++) {
            newObj.r.properties[keys[i]] = currentObj.r.properties[keys[i]]; // Put properties back in alphabetical order
          }
          data.push(newObj);

          console.log("%s/n",JSON.stringify(newObj));
        },
        onCompleted: function () {
          // store data
          backup.fs.appendFile(`${backup.finalPath}/rels_${backup.relFiles++}.txt`, JSON.stringify(data), (err) => {
            if (err) throw err;
          });

          // send progress back to client
          const lastID = data[data.length-1].r.properties.M_GUID;
          const update = {"numRels":data.length, "lastID":lastID};
          response.end(JSON.stringify(update));
          session.close();
        },
        onError: function (error) {
          console.log(error);
        }
      });
  }

  //--------------------------------------Restore code---------------

  startRestore(query, response) {
    this.restoreFolder = query.folder;
    this.restorePath = `${this.config.neo4jBackup}/${this.restoreFolder}`;
    const nodePath = `${this.restorePath}/nodeMetaData.txt`;

    this.fs.readFile(nodePath, function(err, data) {
      if (err) {
        console.log(err);
      }
      else {
        response.end(data);
      }
    });
  }

  getRelData(query, response) {
    const relPath = `${this.restorePath}/relMetaData.txt`;
    this.fs.readFile(relPath, function(err, data) {
      if (err) {
        console.log(err);
      }
      else {
        response.end(data);
      }
    });
  }

  restoreNodes(query, response) {
    const filePath = `${this.restorePath}/nodes_${this.nodeFiles++}.txt`;
    if (this.fs.existsSync(filePath)) {
      const backup = this;
      this.fs.readFile(filePath, function(err, stringData) {
        if (err) {
          console.log(err);
        }
        else {
          const session = backup.driver.session();

          let steps = "create ";
          const data = JSON.parse(stringData);
          for (let i = 0; i < data.length; i++) { // for every node...
            const props = data[i].n.properties;
            let properties = "";
            for (let propName in props) { // loop through all properties and create text to set them...
              // If the property is an object with a low and high value (a number), take the low value
              let value = props[propName];
              if (typeof value.low !== "undefined") {
                value = value.low;
              }
              else if (typeof value === "string") { // if it's a string, string escape it and put it in quotes
                value = `"${backup.stringEscape(value)}"`;
              }
              else { // if it's neither a number nor a string, stringify it
                value = `${JSON.stringify(value)}`;
              }
              properties += `${propName}: ${value}, `;
            }
            if (properties.length > 0) {
              properties = properties.slice(0, properties.length - 2); // remove the last ", "
            }

            let nodeText = `(n${i}:${data[i].n.labels[0]} {${properties}}), `; // Create text to make the node
            steps += nodeText; // add to the request
          } // end for (create command to restore each node)
          if (steps.length > 7) { // If at least one node needs to be added - which SHOULD always be the case
            steps = steps.slice(0, steps.length - 2);

            session
              .run(steps)
              .subscribe({ // I don't think we need to return the data we're creating
                onCompleted: function () { // get the number and type of node restored and return it using response.end
                  const obj = {};
                  obj.numNodes = data.length;
                  obj.name = data[0].n.labels[0]; // There should be at least one item and they should all have the same type
                  response.end(JSON.stringify(obj));
                  session.close();
                },
                onError: function (error) {
                  console.log(error);
                }
              });

          } // end if (at least one node needs to be restored)
          else { // this should never happen - but may as well prepare for it
            alert ("Error: Tried to restore an empty set of nodes");
          }
        } // end else (file could be read)
      }); // end readFile call
    } // end if (file exists)
    else {
      response.end("Out of nodes");
    }
  }

  restoreRels(query, response) {
    const filePath = `${this.restorePath}/rels_${this.relFiles++}.txt`;
    if (this.fs.existsSync(filePath)) {
      const backup = this;
      this.fs.readFile(filePath, function(err, stringData) {
        if (err) {
          console.log(err);
        }
        else {
          const session = backup.driver.session();

          const data = JSON.parse(stringData);
          let nodeText = "";
          let relText = "";

          for (let i = 0; i < data.length; i++) { // for every relation...
            nodeText += `(a${i} {M_GUID:'${data[i].a}'}), (b${i} {M_GUID:'${data[i].b}'}), `

            const rProps = data[i].r.properties;
            let rProperties = "";
            for (let propName in rProps) { // loop through all properties of the relation and create text to set them...
              let value = rProps[propName];

              if (typeof value.low !== "undefined") {
                value = value.low;
              }
              else if (typeof value === "string") { // if it's a string, string escape it and put it in quotes
                value = `"${backup.stringEscape(value)}"`;
              }
              else { // if it's neither a number nor a string, stringify it
                value = `${JSON.stringify(value)}`;
              }

              rProperties += `${propName}: ${value}, `;
            }
            if (rProperties.length > 0) {
              rProperties = rProperties.slice(0, rProperties.length - 2); // remove the last ", "
            }
            relText += `(a${i})-[r${i}:${data[i].r.type} {${rProperties}}]->(b${i}), `
          }
          if (nodeText.length > 0 && relText.length > 0) { // Assuming that at least one relation between two nodes was found
            nodeText = nodeText.slice(0, nodeText.length - 2);
            relText = relText.slice(0, relText.length - 2);
            let steps = `match ${nodeText} create ${relText}`;

            session
              .run(steps)
              .subscribe({ // I don't think we need to return the data we're creating
                onCompleted: function () { // get the number and type of rel restored and return it using response.end
                  const obj = {};
                  obj.numRels = data.length;
                  obj.name = data[0].r.type; // There should be at least one item and they should all have the same type
                  response.end(JSON.stringify(obj));
                  session.close();
                },
                onError: function (error) {
                  console.log(error);
                }
              });
          }
          else { // this should never happen - but may as well prepare for it
            alert ("Error: Tried to upload an empty set of nodes");
          }
        } // end else (file could be read)
      }); // end readFile call
    } // end if (file exists)
    else {
      response.end("Out of rels");
    }
  }
}
