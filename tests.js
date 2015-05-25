var test = require('tape');
var Stream = require('stream')
var ComlinkClient = require('./client');
var ComlinkServer = require('./server');

var mkStream = function(){
  var stream = new Stream();
  stream.writable = stream.readable = true;
  stream.destroy = function(){
  };
  return stream;
};

var logStream = function(stream, name){
  stream.on('connect', function(){
    console.log(name, 'connect');
  });
  stream.on('data', function(data){
    console.log(name, 'data', data);
  });
};

var setup = function(o, connection_timeline){
  var onStream = ComlinkServer(undefined, undefined, o, true);
  var client = ComlinkClient(undefined, function(){

    var client_stream = mkStream();
    var server_stream = mkStream();
    client_stream.write = function(data){
      server_stream.emit('data', data);
    };
    server_stream.write = function(data){
      client_stream.emit('data', data);
    };
    //logStream(client_stream, 'client_stream');
    //logStream(server_stream, 'server_stream');

    if(connection_timeline.length === 0){
      throw new Error('connection_timeline is empty!');
    }
    var curr_connection = connection_timeline[0];
    connection_timeline = connection_timeline.slice(1);

    if(curr_connection.immediate){
      process.nextTick(function(){
        onStream(server_stream);
        client_stream.emit('connect');
      });
    }else if(curr_connection.wait){
      setTimeout(function(){
        onStream(server_stream);
        client_stream.emit('connect');
      }, curr_connection.wait);
    }

    return client_stream;
  });

  return client;
};

test("connect then call functions", function(t){
  t.plan(6);

  var client = setup({
    hello: (function(){
      var call_n = 0;
      return function(name, callback){
        t.equals(name, call_n === 0 ? 'martin' : 'tim');
        call_n++;
        process.nextTick(function(){
          callback(undefined, 'Hello, '+ name);
        });
      };
    }())
  }, [
    {immediate: true}
  ]);

  client.on('remote', function(){
    client.call('hello', 'martin', function(err, resp){
      t.notOk(err);
      t.equals(resp, 'Hello, martin');
    });
    client.call('hello', 'tim', function(err, resp){
      t.notOk(err);
      t.equals(resp, 'Hello, tim');
    });
  });
});

test("call then connect", function(t){
  t.plan(6);

  var client = setup({
    hello: (function(){
      var call_n = 0;
      return function(name, callback){
        t.equals(name, call_n === 0 ? 'martin' : 'tim');
        call_n++;
        process.nextTick(function(){
          callback(undefined, 'Hello, '+ name);
        });
      };
    }())
  }, [
    {wait: 10}
  ]);

  client.call('hello', 'martin', function(err, resp){
    t.notOk(err);
    t.equals(resp, 'Hello, martin');
  });
  client.call('hello', 'tim', function(err, resp){
    t.notOk(err);
    t.equals(resp, 'Hello, tim');
  });
});
