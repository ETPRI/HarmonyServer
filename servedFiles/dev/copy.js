class copy {
  constructor() {
    this.nodes = [];
    this.rels = [];
    this.nodesDone = [];
    this.relsDone = [];
    this.blocksize = 100;
    this.progress = document.getElementById('progress');

  }

  //-----------------------------------Copy code-----------------------------

  checkOtherDB(copy) {
    this.destination = `http://${document.getElementById('copyDestination').value}`;
    var xhttp2 = new XMLHttpRequest();
    xhttp2.onload = function() {
      // call back function when state of send changes
      const results = JSON.parse(this.responseText);
      if (results.length == 0) {
        copy.startCopyTo(copy);
      }
      else alert("Could not proceed because the target database is not empty.");
    };
    xhttp2.open("POST", this.destination);
    const steps = "MATCH (n) return n limit 1"
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp2.send(JSON.stringify(obj));         // send request to server
  }

  checkLocalDB(copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
      // call back function when state of send changes
      const results = JSON.parse(this.responseText);
      if (results.length == 0) {
        copy.startRestore(copy);
      }
      else alert("Could not proceed because the local database is not empty.");
    };
    xhttp.open("POST", "");
    const steps = "MATCH (n) return n limit 1"
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  startCopyTo(copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
      copy.nodes = JSON.parse(this.responseText);
      for (let i = 0; i < copy.nodes.length; i++) {
        copy.nodesDone[i] = 0;
        copy.progress.innerHTML +=
        `<tr><td>Node</td><td>${copy.nodes[i].L}</td><td id="nodeCount${i}">0</td><td>${copy.nodes[i].count.low}</td></tr>`;
      }
      copy.startRels(copy);
      }
    };

    xhttp.open("POST", "");
    const steps = "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count"
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  startRels(copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
      copy.rels = JSON.parse(this.responseText);
      for (let i = 0; i < copy.rels.length; i++) {
        copy.relsDone[i] = 0;
        copy.progress.innerHTML +=
        `<tr><td>Relation</td><td>${copy.rels[i].type}</td><td id="relCount${i}">0</td><td>${copy.rels[i].count.low}</td></tr>`;
      }
      copy.downloadNodes(0, 0, copy);
      }
    };

    xhttp.open("POST", "");
    const steps =   "MATCH (a)-[r]->(b) return distinct type(r) as type, count(r) as count order by type";
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  downloadNodes(typeIndex, minimum, copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        const results = JSON.parse(this.responseText);

        // call next function
        copy.uploadNodes(typeIndex, minimum, copy, results);
      }
    };

    xhttp.open("POST", "");
    let where = "";
    if (minimum > 0) {
      where = `where ID(n) > ${minimum}`;
    }
    const steps = `match (n: ${copy.nodes[typeIndex].L}) ${where} return n order by ID(n) limit ${copy.blocksize}`;
    const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  uploadNodes(typeIndex, minimum, copy, data) {
    var xhttp2 = new XMLHttpRequest();
    xhttp2.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar
        copy.nodesDone[typeIndex] += data.length;
        const count = document.getElementById(`nodeCount${typeIndex}`);
        count.textContent = copy.nodesDone[typeIndex];

        // call next function - either downloading more nodes, or downloading rels
        if (copy.nodesDone[typeIndex] < copy.nodes[typeIndex].count.low) {  // If there are more nodes of this type to download
          // Get the LAST item from the results and retrieve its ID
          const last = data[copy.blocksize - 1];
          minimum = last.n.identity.low;
        }
        else {
          minimum = 0;
          typeIndex++;
        }

        if (typeIndex < copy.nodes.length) {
          copy.downloadNodes(typeIndex, minimum, copy);
        }
        else {
          copy.downloadRels(0, 0, copy);
        }
      }
    };
    xhttp2.open("POST", this.destination);

    let steps = "create ";
    for (let i = 0; i < data.length; i++) { // for every node...
      const props = data[i].n.properties;
      let properties = "";
      for (let propName in props) { // loop through all properties and create text to set them...
        // If the property is an object with a low and high value, take the low one
        let value = props[propName];
        if (typeof value.low !== "undefined") {
          value = JSON.stringify(value.low);
        }
        else if (typeof value !== "string") {
          value = JSON.stringify(value);
        }
        properties += `${propName}: '${copy.stringEscape(value)}', `;
      }
      if (properties.length > 0) {
        properties = properties.slice(0, properties.length - 2); // remove the last ", "
      }

      let nodeText = `(n${i}:${copy.nodes[typeIndex].L} {${properties}}), `; // Crate text to make the node
      steps += nodeText; // add to the request
    }
    if (steps.length > 7) { // If at least one node needs to be added - which SHOULD always be the case
      steps = steps.slice(0, steps.length - 2);
      const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server
      xhttp2.send(JSON.stringify(obj));         // send request to server
    }
    else { // this should never happen - but may as well prepare for it
      alert ("Error: Tried to upload an empty set of nodes");
    }
  }

  downloadRels(typeIndex, minimum, copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        const results = JSON.parse(this.responseText);

        // call next function
        copy.uploadRels(typeIndex, minimum, copy, results);
      }
    };

    xhttp.open("POST", "");
    let where = "";
    if (minimum > 0) {
      where = `where ID(r) > ${minimum}`;
    }

    const steps = `match (a)-[r:${copy.rels[typeIndex].type}]->(b) ${where} return a, b, r order by ID(r) limit ${copy.blocksize}`;
    const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  uploadRels(typeIndex, minimum, copy, data) {
    var xhttp2 = new XMLHttpRequest();
    xhttp2.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar
        copy.relsDone[typeIndex] += data.length;
        const count = document.getElementById(`relCount${typeIndex}`);
        count.textContent = copy.relsDone[typeIndex];

        if (copy.relsDone[typeIndex] < copy.rels[typeIndex].count.low) { // If there are more relations of this type to download
          // Get the LAST item from the results and retrieve its ID
          const last = data[copy.blocksize-1];
          minimum = last.r.identity.low;
        }
        else {
          minimum = 0;
          typeIndex++;
        }

        // call next function - either downloading more rels, or ending the copy process
        if (typeIndex < copy.rels.length) {
          copy.downloadRels(typeIndex, minimum, copy);
        }
        else {
          copy.progress.innerHTML += "Done!";
        }
      }
    };
    xhttp2.open("POST", this.destination);

    let nodeText = "";
    let relText = "";

    for (let i = 0; i < data.length; i++) { // for every relation...
      nodeText += `(a${i} {M_GUID:'${data[i].a.properties.M_GUID.low}'}), (b${i} {M_GUID:'${data[i].b.properties.M_GUID.low}'}), `

      const rProps = data[i].r.properties;
      let rProperties = "";
      for (let propName in rProps) { // loop through all properties of the relation and create text to set them...
        let value = rProps[propName];

        if (typeof value.low !== "undefined") {
          value = JSON.stringify(value.low);
        }
        else if (typeof value !== "string") {
          value = JSON.stringify(value);
        }
        rProperties += `${propName}: '${copy.stringEscape(value)}', `;
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
      const obj = {"server": "neo4j", "query": steps};  // create object to send to server
      xhttp2.send(JSON.stringify(obj));         // send request to server
    }
    else { // this should never happen - but may as well prepare for it
      alert ("Error: Tried to upload an empty set of relations");
    }
  }

  //------------------------------------Backup code--------------------------

  startBackup(copy) {
    this.progress.innerHTML = "";
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar and nodesDone array...
        const nodesDone = [];
        const results = JSON.parse(this.responseText); // array of node objects, containing name and target.
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Node</td><td>${results[i].name}</td><td id="nodeCount${i}">0</td><td>${results[i].target}</td></tr>`;
          nodesDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        copy.findRels(nodesDone, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "findNodes"}; // query to start the backup process
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  findRels(nodesDone, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar and relsDone array...
        const relsDone = [];
        const results = JSON.parse(this.responseText); // array of node objects, containing name and target.
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Rel</td><td>${results[i].name}</td><td id="relCount${i}">0</td><td>${results[i].target}</td></tr>`;
          relsDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        const progress = {"nodesDone":nodesDone, "relsDone":relsDone};
        copy.backupNodes(0,0, progress, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "findRels"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  backupNodes(index, minimum, progress, copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar...
        const results = JSON.parse(this.responseText); // object containing numNodes and lastID
        progress.nodesDone[index].done += results.numNodes;
        document.getElementById(`nodeCount${index}`).textContent = progress.nodesDone[index].done;

        // update variables
        if (progress.nodesDone[index].done < progress.nodesDone[index].target) {
          minimum = results.lastID;
        }
        else {
          index++;
          minimum = 0;
        }

        // and send next request
        if (index < progress.nodesDone.length) {
          copy.backupNodes(index, minimum, progress, copy);
        }
        else {
          copy.backupRels(0, 0, progress, copy);
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "backupNodes", "name": progress.nodesDone[index].name, "minimum": minimum, "blocksize": this.blocksize}; // query to start the backup process
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  backupRels(index, minimum, progress, copy) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar...
        const results = JSON.parse(this.responseText); // object containing numRels and lastID
        progress.relsDone[index].done += results.numRels;
        document.getElementById(`relCount${index}`).textContent = progress.relsDone[index].done;

        // update variables
        if (progress.relsDone[index].done < progress.relsDone[index].target) {
          minimum = results.lastID;
        }
        else {
          index++;
          minimum = 0;
        }

        // and send next request
        if (index < progress.relsDone.length) {
          copy.backupRels(index, minimum, progress, copy);
        }
        else {
          copy.progress.innerHTML += "Done!"
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "backupRels", "name": progress.relsDone[index].name, "minimum": minimum, "blocksize": this.blocksize}; // query to back up the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }


  //------------------------------------Restore code-------------------------

  startRestore(copy) {
    const restoreFolder = document.getElementById('backupSource').value;
    this.progress.innerHTML = "";
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar and nodesDone array...
        const nodesDone = [];
        const results = JSON.parse(this.responseText); // array of node objects, containing name and target.
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Node</td><td>${results[i].name}</td><td id="nodeCount_${results[i].name}">0</td><td>${results[i].target}</td></tr>`;
          nodesDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        copy.getRelData(nodesDone, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "startRestore", "folder":restoreFolder}; // query to start the backup process
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  getRelData(nodesDone, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        // Update progress bar and relsDone array...
        const relsDone = [];
        const results = JSON.parse(this.responseText); // array of rel objects, containing name and target.
        for (let i = 0; i < results.length; i++) {
          copy.progress.innerHTML +=
          `<tr><td>Rel</td><td>${results[i].name}</td><td id="relCount_${results[i].name}">0</td><td>${results[i].target}</td></tr>`;
          relsDone[i] = {"name":results[i].name, "done":0, "target":results[i].target};
        }
        // and send next request
        const progress = {"nodesDone":nodesDone, "relsDone":relsDone};
        copy.restoreNodes(progress, copy);
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "getRelData"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  restoreNodes(progress, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        if (this.responseText == "Out of nodes") { // signal to move on to rels
          copy.restoreRels(progress, copy);
        }
        else {
          // Update progress bar and nodesDone array...
          const results = JSON.parse(this.responseText); // object containing name and number of nodes restored
          const type = progress.nodesDone.find(x => x.name === results.name);
          type.done += results.numNodes;
          document.getElementById(`nodeCount_${results.name}`).textContent = type.done;

          // and send next request
          copy.restoreNodes(progress, copy);
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "restoreNodes"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  restoreRels(progress, copy) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      // call back function when state of send changes
      if (this.readyState == 4 && this.status == 200) {
        if (this.responseText == "Out of rels") { // signal to move on to rels
          copy.progress.innerHTML += "Done!";
        }
        else {
          // Update progress bar and nodesDone array...
          const results = JSON.parse(this.responseText); // object containing name and number of relations restored
          const type = progress.relsDone.find(x => x.name === results.name);
          type.done += results.numRels;
          document.getElementById(`relCount_${results.name}`).textContent = type.done;

          // and send next request
          copy.restoreRels(progress, copy);
        }
      } // end if (readystate = 4, status = 200)
    }; // end of callback function

    xhttp.open("POST", "");
    const obj = {"server": "backupNeo4j"};  // create object to send to server
    const query = {"functionName": "restoreRels"}; // query to find the relations
    obj.query = query;

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  //------------------------------------Helper functions---------------------

  // Escapes special character in a string. Stringifying it and then removing the outer quotes is a good shortcut.
  stringEscape(text) {
  	let string = JSON.stringify(text);
  	string = string.substring(1, string.length-1);
    if (string.indexOf("'") > -1) {
      string = string.replace(/'/g, "\\'");
    }
  	return string;
  }
}
