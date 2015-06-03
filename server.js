var deepFreeze = require('deep-freeze');

module.exports = function(o){
  var whatFnsShouldBeUsableNow = o.whatFnsShouldBeUsableNow || function(){
    return [];
  };
  var loadDataForSessionID = o.loadDataForSessionID || function(session_id, callback){
    callback(undefined, {});
  };
  var fns = o.fns || {};
  fns.comlink_hello = true;//placeholder (and it ensures it's not overridden)

  return function(socket){
    var client = {
      emit: socket.emit.bind(socket),
      socket_id: socket.id,
      session_id: undefined,
      setState: function(new_state){
        client.state = deepFreeze(new_state);
        onStateChange();
      },
      state: deepFreeze({})
    };

    var event_handlers = Object.keys(fns).map(function(name){
      var fn = fns[name];
      if(name === 'comlink_hello'){
        fn = function(_, params, callback){
          loadDataForSessionID(params.session_id, function(err, data){
            client.session_id = params.session_id;
            client.state = deepFreeze(data);
            onStateChange();
            callback(err, client.session_id);
          });
        };
      }

      var is_on = false;
      var handler = function(params, callback){
        try{
          fn(client, params, callback);
        }catch(e){
          callback(e);
        }
      };
      return {
        name: name,
        turnOn: function(){
          if(is_on) return;//already on
          is_on = true;
          socket.on(name, handler);
        },
        turnOff: function(){
          if(!is_on) return;//already off
          is_on = false;
          socket.removeListener(name, handler);
        }
      };
    });

    var onStateChange = function(){
      var fn_names = !client.session_id ? ['comlink_hello'] : whatFnsShouldBeUsableNow(client.state);

      var keyed = {};
      fn_names.forEach(function(name){
        keyed[name] = true;
      });

      event_handlers.forEach(function(h){
        if(keyed[h.name] === true){
          h.turnOn();
        }else{
          h.turnOff();
        }
      });
    };
    //set up the initial state
    onStateChange();
  };
};
