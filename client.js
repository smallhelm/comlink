var cuid = require('cuid');
var has_localstorage = require('has-localstorage')();
var my_id;
if(has_localstorage){
  my_id = localStorage.getItem('comlink_client_session_id');
}
if(!my_id){
  my_id = cuid();
}
if(has_localstorage){
  localStorage.setItem('comlink_client_session_id', my_id);
}

module.exports = function(socket, onHello){
  socket.on('connect', function(){
    socket.emit('comlink_hello', {session_id: my_id}, function(err, session_id){
      if(my_id !== session_id){
        my_id = session_id;
        if(has_localstorage){
          localStorage.setItem('comlink_client_session_id', my_id);
        }
      }
      if(onHello){
        onHello(err, session_id);
      }
    });
  });
  return {
    call: function(name, params, callback){
      socket.emit(name, params, callback);
    }
  };
};
