class GUID {
  constructor() {
    this.nodes = [];
    this.rels = [];
  }

  start(guid) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        guid.nodes = JSON.parse(this.responseText);
        guid.processNode(guid);
      }
    };
    xhttp.open("POST", "");
    const steps = "MATCH (n) return ID(n) as id";
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  processNode(guid) {
    const node = this.nodes.pop();
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        if (guid.nodes.length > 0) {
          guid.processNode(guid);
        }
        else {
          guid.getRels(guid);
        }
      }
    };
    xhttp.open("POST", "");
    const steps = `MATCH (n) where ID(n) = ${node.id.low} set n.M_GUID = '${uuidv1()}'`;
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  getRels(guid) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        guid.rels = JSON.parse(this.responseText);
        guid.processRel(guid);
      }
    };
    xhttp.open("POST", "");
    const steps = "MATCH ()-[r]->() return ID(r) as id";
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }

  processRel(guid) {
    const rel = this.rels.pop();
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        if (guid.rels.length > 0) {
          guid.processRel(guid);
        }
        else {
          alert("Done");
        }
      }
    };
    xhttp.open("POST", "");
    const steps = `MATCH ()-[r]->() where ID(r) = ${rel.id.low} set r.M_GUID = '${uuidv1()}'`;
    const obj = {"server": "neo4j", "query": steps};  // create object to send to server

    xhttp.send(JSON.stringify(obj));         // send request to server
  }
}
