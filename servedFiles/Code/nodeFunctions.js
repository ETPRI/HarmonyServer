class nodeFunctions {
  constructor() {
  }
  //
  // login(name, password) {
  //   const xhttp = new XMLHttpRequest();
  //
  //   xhttp.onreadystatechange = function() {
  //     if (this.readyState == 4 && this.status == 200) {
  //       // send results to loginComplete function
  //       app.login.loginComplete(JSON.parse(this.responseText));
  //     }
  //   };
  //
  //   const steps = `match (user)-[rel:Permissions {username:"${name}", password:"${password}"}]->(table:LoginTable)
  //                     return ID(user) as userID, user.name as name, table.name as permissions`;
  //
  //   xhttp.open("POST", "query");
  //   const obj = {"query": steps}; // steps is the actual query
  //   xhttp.send(JSON.stringify(obj));         // send request to server
  // }

  /*
    Object contains:
      Object representing "from" node, which may include name, type, ID, or properties (object)
      Object representing "to" node (ditto)
      Object representing relation (ditto)
      Object representing CHANGES to relation: {prop1:"prop1", prop2:"prop2"...}

      Build a string following the pattern:
      match (name:type {prop1: "prop1", prop2:"prop2"})-[name:type {prop1: "prop1", prop2:"prop2"}]->(name:type {prop1: "prop1", prop2:"prop2"})
      where ID(name) = ID and ID(name) = ID set name.property = value, name.property = value return name1, name2
  */
  changeRelation(dataObj, methodObj, methodName, ...args) {
    // These strings are stored in an object so they can be passed in and out of methods and updated
    let strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings);
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings);
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings);
    }

    // Build the string representing the changes - what comes after the SET keyword
    let changes ="";
    if (dataObj.changes && dataObj.rel.name) { // You can't really request changes to a relation unless you can refer to it by name
      for (let prop in dataObj.changes) {
        if (changes == "") {
          changes = `set ${dataObj.rel.name}.${prop} = "${dataObj.changes[prop]}"`;
        }
        else changes += `, ${dataObj.rel.name}.${prop} = "${dataObj.changes[prop]}"`;
      }
    }

    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        // send results to desired function
        methodObj[methodName](JSON.parse(this.responseText), ...args);
      }
    };

    const query = `match (${from})-[${rel}]->(${to}) ${strings.where} ${changes} ${strings.ret}`;

    xhttp.open("POST", "query");
    const queryObject = {"query": query};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }

  // Builds a string that represents a single node or relation, using its name, type, ID and properties
  buildSearchString(obj, strings) {
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

    if (obj.id && obj.name) { // You can't (or at least I don't know how to) request an item by ID without naming it
      if (strings.where == "") {
        strings.where = `where ID(${obj.name}) = ${obj.id}`;
      }
      else strings.where += ` and ID(${obj.name}) = ${obj.id}`;
    }

    return string;
  }
}
