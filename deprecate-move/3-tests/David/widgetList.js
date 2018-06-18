var Gcount = 0;

class widgetList {
//   this.name llll
//   var count;

    constructor(n) {
        this.name = n;
        this.count = Gcount++;
    }

    search() {
      var fcount=1;
			alert("this.name=" + this.name + " this.count="+this.count
      + " Gcount=" + Gcount + " fcount="+fcount);
    }
}
