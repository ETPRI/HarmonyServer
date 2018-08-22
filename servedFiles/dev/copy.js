class copy {
  constructor() {
    this.nodes = [];
    this.rels = [];
    this.nodesDone = [];
    this.relsDone = [];
    this.blocksize = 100;
    this.progress = document.getElementById('progress');

  }

  checkDB(copy) {
    this.destination = `http://${document.getElementById('destination').value}`;
    var xhttp2 = new XMLHttpRequest();
    xhttp2.onload = function() {
      // call back function when state of send changes
      const results = JSON.parse(this.responseText);
      if (results.length == 0) {
        copy.startNodes(copy);
      }
      else alert("Could not proceed because the target database is not empty.");
    };
    xhttp2.open("POST", this.destination);
    const steps = "MATCH (n) return n limit 1"
    const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

    xhttp2.send(JSON.stringify(obj));         // send request to server
  }

  startNodes(copy) {
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
    const obj = {"server": "neo4j", "query": steps};  // crearte object to send to server

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
      nodeText += `(a${i} {GUID:'${data[i].a.properties.GUID.low}'}), (b${i} {GUID:'${data[i].b.properties.GUID.low}'}), `

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
