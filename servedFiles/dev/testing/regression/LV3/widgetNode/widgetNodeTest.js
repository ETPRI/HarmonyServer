class widgetNodeTest{
  constructor() {
    this.db = new db();
  }

  clearAll(button) { // Clears all "Test" nodes for a well-defined starting place
    this.db.setQuery("match (n:Test) DETACH DELETE n");
    this.db.runQuery(this, "clearComplete");
  }

  clearComplete(data) { // Records result of clearAll and allows next step in playback
    let obj = {};
    obj.id = "clear";
    obj.action="click";
    obj.data = data;
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  getFirst(button) { // Gets the first Test node and passes it to editFirst
    let query = `match(n:Test) return n order by ${app.metaData.node.Test.orderBy} limit 1`;
    this.db.setQuery(query);
    this.db.runQuery(this, "editFirst");
  }

  editFirst(data) { // opens the node passed into it for editing
    if (data) {
      new widgetNode("Test", data[0].n.identity);
    }
    else {
      new widgetNode("Test");
    }

    // log
    let obj = {};
    obj.id = "edit";
    obj.action = "click";
    obj.data = JSON.parse(JSON.stringify(data)); // easy way to make a deep copy
    app.stripIDs(obj.data);
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  getAll(button) { // gets all Test nodes and passes them to logAll
    this.db.setQuery(`match (n:Test) return n order by ${app.metaData.node.Test.orderBy}`);
    this.db.runQuery(this, "logAll");
  }

  logAll(data) { // logs the result of querying for all Test nodes
    let obj = {};
    obj.id = "getAll";
    obj.action = "click";
    obj.data = JSON.parse(JSON.stringify(data)); // easy way to make a deep copy
    app.stripIDs(obj.data);
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }

  create(button) { // creates a new widgetNode table with no data
    new widgetNode("Test");

    // log
    let obj = {};
    obj.id = button.id;
    obj.action = "click";
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }
}
