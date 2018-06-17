class dbTest {
  constructor() {
    this.db = new db();
    this.input = document.getElementById("input");
  }

  startQuery() { // runs when the user clicks the "run query" button; runs the query they typed and then calls finishedQuery
    this.db.setQuery(this.input.value);
    this.db.runQuery(this, "finishedQuery");
  }

  finishedQuery(data) { // runs when a query finishes. Just records and logs the result.
    let obj = {};
    obj.id = "run";
    obj.action = "click";
    obj.data = JSON.parse(JSON.stringify(data)); // copies the data so we can remove ids if needed
    app.stripIDs(obj.data);
    app.regression.record(obj);
    app.regression.log(JSON.stringify(obj));
  }

  queryChange(element) { // Runs when the user changes what is typed in the query box. Just records what they typed.
    let obj = {};
    obj.id = element.id;
    obj.value = element.value;
    obj.action = "change";
    app.regression.record(obj);
    app.regression.log(JSON.stringify(obj));
  }
}
