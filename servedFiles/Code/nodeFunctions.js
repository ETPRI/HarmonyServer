class nodeFunctions {
  constructor() {
  }

  // HELPER FUNCTIONS
  buildSearchString(obj, strings, whereString) {
    let string =  "";

    if (obj.name) {
      string += obj.name;
      if (strings.ret == "") {
        strings.ret = `return ${obj.name}`;
      }
      else strings.ret += `, ${obj.name}`;
    }
    if (obj.type) {
      string += `:${obj.type}`;
    }

    if (obj.properties) {
      let props = "";
      for (let prop in obj.properties) {
        if (props == "") {
          props = `${prop}: "${obj.properties[prop]}"`;
        }
        else props += `, ${prop}: "${obj.properties[prop]}"`;
      }
      string += `{${props}}`;
    }

    if (obj.id && obj.name && whereString) { // You can't (or at least I don't know how to) request an item by ID without naming it
      if (strings[whereString] == "") {
        strings[whereString] = `where ID(${obj.name}) = ${obj.id}`;
      }
      else strings[whereString] += ` and ID(${obj.name}) = ${obj.id}`;
    }

    return string;
  }

  sendQuery(query, methodObj, methodName, ...args) {
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        // Results should be an array of row objects. Each row object will contain one object per item to return.
        // Each of THOSE may contain an identity object which should be rewritten as a simple number.
        // Also, row objects from metadata queries may include an id or count variable, which should also be rewritten.
        const result = JSON.parse(this.responseText);
        for (let i = 0; i < result.length; i++) {
          const row = result[i];
          if (row.count) {
            row.count = row.count.low;
          }
          if (row.id) {
            row.id = row.id.low;
          }

          for (let item in row) {
            const entry = row[item];
            if (entry && entry.identity) {
              const IDobj = entry.identity;
              const ID = IDobj.low;
              entry.ID = ID;
              delete entry.identity;
            }
          }
        }
        // send results to desired function
        if (methodObj && methodName) {
          methodObj[methodName](result, ...args);
        }
      }
    };

    xhttp.open("POST", "query");
    const queryObject = {"query": query};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }

  // BASIC FUNCTIONS
  // object represents node.  May include name, type, or properties (object). May include merge boolean.
  createNode(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""}; // where won't be used here, but I'm including it for consistency
    const node = this.buildSearchString(dataObj, strings, "where");
    let command = "create";
    if (dataObj.merge && dataObj.merge == true) {
      command = "merge";
    }

    const query = `${command} (${node}) ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  // object represents node.  May include type, ID, or properties (object). Must include name.
  deleteNode(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};
    const node = this.buildSearchString(dataObj, strings, "where");

    const query = `match (${node}) detach delete ${dataObj.name}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
    Object contains:
      object representing node, which may include name, type, ID, or properties (object)
      object representing changes to node: {prop1:"prop1", prop2:"prop2"...}
  */
  changeNode(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};
    // Build the string representing the node - what goes in the parentheses
    const node = this.buildSearchString(dataObj.node, strings, "where");

    // Build the string representing the changes - what comes after the SET keyword
    let changes ="";
    if (dataObj.changes && dataObj.node.name) { // You can't really request changes to a relation unless you can refer to it by name
      for (let prop in dataObj.changes) {
        let value = `"${dataObj.changes[prop]}"`;
        if (dataObj.changes[i].string === false) { // default is that the new value is a string, but can be overridden
          value = `${dataObj.changes[prop]}`;
        }

        if (changes == "") {
          changes = `set ${dataObj.node.name}.${prop} = ${value}`;
        }
        else changes += `, ${dataObj.node.name}.${prop} = ${value}`;
      }
    }

    const query = `match (${node}) ${strings.where} ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
    Object contains:
      Object representing "from" node, which may include type, ID, or properties (object), and must include name
      Object representing "to" node (ditto)
      Object representing relation (ditto, except no ID and can include merge boolean)
  */
  createRelation(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where");
    }

    let command = "create";
    if (dataObj.rel.merge && dataObj.rel.merge == true) {
      command = "merge";
    }

    const query = `match (${from}), (${to}) ${strings.where} ${command} (${dataObj.from.name})-[${rel}]->(${dataObj.to.name})`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
    Object contains:
      Object representing "from" node, which may include name, type, ID, or properties (object)
      Object representing "to" node (ditto)
      Object representing relation (ditto, but must include name)
  */
  deleteRelation(dataObj, methodObj, methodName, ...args) {
    // These strings are stored in an object so they can be passed in and out of methods and updated
    const strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where");
    }

    const query = `match (${from})-[${rel}]->(${to}) ${strings.where} delete ${dataObj.rel.name} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
    Object contains:
      Object representing "from" node, which may include name, type, ID, or properties (object)
      Object representing "to" node (ditto)
      Object representing relation (ditto)
      Object representing CHANGES to relation: {prop1:"prop1", prop2:"prop2"...}
  */
  changeRelation(dataObj, methodObj, methodName, ...args) {
    // These strings are stored in an object so they can be passed in and out of methods and updated
    const strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where");
    }

    // Build the string representing the changes - what comes after the SET keyword
    // Rewrite this to allow changes to nodes as well as relation
    // Current structure: dataObj.changes = {prop:"prop", prop2:"prop2"...} and just assumes the item is the relation
    // New structure: dataObj.changes =
    // [{item:"item", property:"property", value:"value"}, {item:"item2", property:"property2", value:"value2"}...]
    let changes ="";
    if (dataObj.changes) {
      for (let i = 0; i < dataObj.changes.length; i++) {
        let value = `"${dataObj.changes[i].value}"`;
        if (dataObj.changes[i].string === false) { // default is that the new value is a string, but can be overridden
          value = `${dataObj.changes[i].value}`;
        }

        if (changes == "") {
          changes = `set ${dataObj.changes[i].item}.${dataObj.changes[i].property} = ${value}`;
        }
        else changes += `, ${dataObj.changes[i].item}.${dataObj.changes[i].property} = ${value}`;
      }
    }

    const query = `match (${from})-[${rel}]->(${to}) ${strings.where} ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  // ADVANCED FUNCTIONS
  findOptionalRelation(dataObj, methodObj, methodName, ...args) {
    // These strings are stored in an object so they can be passed in and out of methods and updated
    // Need TWO where clauses - one for the required node, one for the optional node and relation
    const strings = {ret:"", reqWhere:"", optWhere:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let required = "";
    if (dataObj.required) {
      required = this.buildSearchString(dataObj.required, strings, "reqWhere");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let optional = "";
    if (dataObj.optional) {
      optional = this.buildSearchString(dataObj.optional, strings, "optWhere");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "optWhere");
    }

    // Build the string representing the changes - what comes after the SET keyword
    let changes ="";
    if (dataObj.changes) {
      for (let i = 0; i < dataObj.changes.length; i++) {
        let value = `"${dataObj.changes[i].value}"`;
        if (dataObj.changes[i].string === false) { // default is that the new value is a string, but can be overridden
          value = `${dataObj.changes[i].value}`;
        }
        if (changes == "") {
          changes = `set ${dataObj.changes[i].item}.${dataObj.changes[i].property} = ${value}`;
        }
        else changes += `, ${dataObj.changes[i].item}.${dataObj.changes[i].property} = ${value}`;
      }
    }

    // default is that the relation starts on the required node, but if the direction is specified, it can go backward
    let arrow = `-[${rel}]->`;
    if (dataObj.rel.direction == "left") {
      arrow = `<-[${rel}]-`;
    }

    const query = `match (${required}) ${strings.reqWhere}
                   optional match (${dataObj.required.name})${arrow}(${optional}) ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  changeTwoRelPattern(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};

    // Build the string representing the "start" node - what goes in the first set of parentheses
    let start = "";
    if (dataObj.start) {
      start = this.buildSearchString(dataObj.start, strings, "where");
    }

    // Build the string representing the "middle" node - what goes in the second set of parentheses
    let middle = "";
    if (dataObj.middle) {
      middle = this.buildSearchString(dataObj.middle, strings, "where");
    }

    // Build the string representing the "end" node - what goes in the third set of parentheses
    let end = "";
    if (dataObj.end) {
      end = this.buildSearchString(dataObj.end, strings, "where");
    }

    // Build the string representing the first relation - what goes in the first set of brackets
    let rel1 = "";
    if (dataObj.rel1) {
      rel1 = this.buildSearchString(dataObj.rel1, strings, "where");
    }

    // Build the string representing the second relation - what goes in the first set of brackets
    let rel2 = "";
    if (dataObj.rel2) {
      rel2 = this.buildSearchString(dataObj.rel2, strings, "where");
    }

    // Build the string representing the changes - what comes after the SET keyword
    let changes =``;
    if (dataObj.changes) {
      for (let i = 0; i < dataObj.changes.length; i++) {
        let value = `"${dataObj.changes[i].value}"`;
        if (dataObj.changes[i].string === false) { // default is that the new value is a string, but can be overridden
          value = `${dataObj.changes[i].value}`;
        }
        if (changes == ``) {
          changes = `set ${dataObj.changes[i].item}.${dataObj.changes[i].property} = ${value}`;
        }
        else changes += `, ${dataObj.changes[i].item}.${dataObj.changes[i].property} = ${value}`;
      }
    }
    const query = `match (${start})-[${rel1}]->(${middle})-[${rel2}]->(${end}) ${strings.where} ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  // SPECIFIC FUNCTIONS
  tableNodeSearch(dataObj, methodObj, methodName, ...args) {
    // Example search string:
    // match (n:type) where n.numField < value and n.stringField =~(?i)value
    // optional match (n)-[:Permissions]->(perm:LoginTable) return n, perm.name as permissions
    // order by first, second, third limit 9

    // Notes: use *. for wildcard in string search. Only search for permissions if type = people.
    // Regexes apparently have to be in a where clause, not in curly braces, so for simplicity, put all criteria in where clause.

    // Build the where clause, starting with requirement that current user has not trashed this node
    let where = `where ID(a)=${app.login.userID} and not (a)-[:Trash]->(${dataObj.name}) and `;

    for (let field in dataObj.where) {
      if (dataObj.where[field].fieldType == "string") {
        const w = `${dataObj.name}.${field}=~"(?i)#s#${dataObj.where[field].value}#E#" and `;
        let w1="";
        switch(dataObj.where[field].searchType) {
          case "S":    // start
            w1 = w.replace('#s#',"").replace('#E#','.*');    break;
          case "M":    // middle
            w1 = w.replace('#s#',".*").replace('#E#','.*');  break;
          case "E":    // end
            w1 = w.replace('#s#',".*").replace('#E#','');    break;
          case "=":    // equal to
            w1 = w.replace('#s#',"").replace('#E#','');      break;
          default:
            alert("Error: search type for a string field is not S, M, E or =.");
        }
        where += w1;
      }
      else { // number field
        where += `${dataObj.name}.${field} ${dataObj.where[field].searchType} ${dataObj.where[field].value} and `;
      }
    }

    // Remove the last " and " from the where clause
    where = where.slice(0, -5);

    let permCheck = "";
    let ret = `return ${dataObj.name}`;
    if (dataObj.type == "people") {
      permCheck = "optional match (n)-[:Permissions]->(perm:LoginTable)";
      ret += `, perm.name as permissions`;
    }

    const query = `match (${dataObj.name}:${dataObj.type}), (a) ${where} ${permCheck}
                   ${ret} order by ${dataObj.orderBy} limit ${dataObj.limit}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  addNodeToView(dataObj, methodObj, methodName, ...args) {
    let attributeString = "";
    for (let attribute in dataObj.attributes) {
      attributeString += `${attribute}: "${dataObj.attributes[attribute]}", `;
    }
    if (attributeString.length > 0) { // if any attributes were found, the string needs to have the last ", " removed,
                                      // and it needs to be enclosed in curly braces.
      attributeString = ` {${attributeString.slice(0, -2)}}`;
    }

    const query = `match (per), (start), (end)
                 where ID(per) = ${dataObj.personID} and ID(start) = ${dataObj.startID} and ID(end)=${dataObj.endID}
                 merge (per)-[:Owner]->(view:View {direction:"start"})-[:Subject]->(start)
                 merge (view)-[endLink:Link${attributeString}]->(end)
                 merge (per)-[:Owner]->(view2:View {direction:"end"})-[:Subject]->(end)
                 merge (view2)-[startLink:Link${attributeString}]->(start)
                 return ${dataObj.relation} as link`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  getMetadata(queryName, methodObj, methodName, ...args) {
    const metadataQueries = {
      nodes: "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count"
      ,keysNode: "MATCH (p) unwind keys(p) as key RETURN  distinct key, labels(p) as label,  count(key) as count  order by key"
      ,relations: "MATCH (a)-[r]->(b)  return distinct labels(a), type(r), labels(b), count(r) as count  order by type(r)"
      ,keysRelation: "match ()-[r]->() unwind keys(r) as key return distinct key, type(r), count(key) as count"
      ,myTrash: `match (user)-[rel:Trash]->(node) where ID(user)=${app.login.userID} return id(node) as id, node.name as name, labels(node) as labels, rel.reason as reason, node`
      ,allTrash: `match ()-[rel:Trash]->(node) return ID(node) as id, node.name as name, count(rel) as count`
    }

    this.sendQuery(metadataQueries[queryName], methodObj, methodName, ...args);
  }
}
