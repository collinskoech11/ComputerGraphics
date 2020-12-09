function simulate(){
    $("#flight").addClass("run");
    setTimeout(function(){
      $("#flight").removeClass("run");
    },10000)
  }