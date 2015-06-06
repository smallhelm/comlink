var cuid = require('cuid');
var isCuid = require('is-cuid');
var deepFreeze = require('deep-freeze');

module.exports = function(o){
  var whatFnsShouldBeUsableNow = o.whatFnsShouldBeUsableNow || function(){
    return [];
  };
  var loadDataForSessionID = o.loadDataForSessionID || function(session_id, callback){
    callback(undefined, {});
  };
  var onStateChange = o.onStateChange || function(){
  };
  var transformError = o.transformError || function(err){
    return String(err);
  };
  var onThrownError = o.onThrownError || function(fn_name, err){
    console.error('Caught an error thrown by', fn_name, err);
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
        theStateChanged();
      },
      state: deepFreeze({})
    };

    var event_handlers = Object.keys(fns).map(function(name){
      var fn = fns[name];
      if(name === 'comlink_hello'){
        fn = function(_, params, callback){
          var session_id = params.session_id;
          if(!isCuid(session_id)){
            session_id = cuid();//doesn't look like they have valid cuid, so assign them one
          }
          loadDataForSessionID(session_id, function(err, data){
            client.session_id = session_id;
            client.setState(data);
            callback(err, session_id);
          });
        };
      }

      var is_on = false;
      var handler = function(params, callback_orig){
        var callback = function(){
          var args = Array.prototype.slice.call(arguments);
          if(args[0]){//if error
            args[0] = transformError(args[0]);
          }
          callback_orig.apply(this, args);
        };
        try{
          fn(client, params, callback);
        }catch(e){
          onThrownError(name, e);
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

    var theStateChanged = function(){
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
      onStateChange(client);
    };
    //set up the initial state
    theStateChanged();
  };
};
