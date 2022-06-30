import http from 'http';
import SocketIO from 'socket.io';
import express from 'express';

const app = express();

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');
app.use('/public', express.static(__dirname + '/public'));
app.get('/', (req, res) => {
  res.render('home');
});
app.get('/*', (req, res) => {
  res.redirect('/');
});

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = wsServer;
  // const sids = wsServer.sockets.adapter.sids;
  // const rooms = wsServer.sockets.adapter.rooms;

  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });

  return publicRooms;
}

function countRoom(roomName) {
  console.log(wsServer.sockets.adapter.rooms);
  return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on('connection', (socket) => {
  socket['nickname'] = 'Anon';
  socket.onAny((event) => {
    console.log(`Socket Event: ${event}`);
  });
  socket.on('enter_room', (roomName, nickName, done) => {
    socket.join(roomName);
    done(); // 방에 들어가고 done()함수 실행하면 프론트에서 showRoom함수 실행, 프론트에게 방에 들어왔다고 알려줄 수 있다.
    socket['nickname'] = nickName;
    console.log(roomName, nickName);
    socket.to(roomName).emit('Welcome', socket.nickname, countRoom(roomName)); // "welcome" event를 roomName에 있는 모든 사람에게 emit(방에 들어온 당사자를 제외하고)/ 프론트에서 이 emit에 반응하도록 해줘야함
    wsServer.sockets.emit('room_change', publicRooms()); // 방에 들어왔을 때 방 정보 입력
  });

  socket.on('disconnecting', () => {
    // 창을 닫거나 컴퓨터까 꺼졌을 때 방에 보낼 수 있다.
    socket.rooms.forEach(
      (room) =>
        socket.to(room).emit('bye', socket.nickname, countRoom(room) - 1) // 방을 떠나기 직전, 완전히 떠나지 않았으므로 room이름에 접근할 수 있다. 근데 우리도 포함되서 계산됨으로 -1을 해준다.
    );
    // socket.rooms는 array같은 중복요소가 없는 set이여서 iterable이 가능
  });

  socket.on('disconnect', () => {
    wsServer.sockets.emit('room_change', publicRooms());
  });
  socket.on('new_message', (msg, room, done) => {
    socket.to(room).emit('new_message', `${socket.nickname}: ${msg}`);
    done();
  });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);

// Adapter은 누가 연결되었는지, 현재 어플리케이션에 room이 얼마나 있는지 알려준다.
// io.socket.adapter을 하면 어플리케이션에 연결된 rooms와 socketid 모든 정보가 나온다.
// socket은 private room이 있기 때문에 private message를 보낼 수 있는데 그래서 기본 room과 socketid는 같다
// sids는 백엔드에 연결된 모든 sockets들의 map이다. rooms도 마찬가지
// 여기서 sids와 rooms를 이용해 public room의 id만 가져올 수 있다.
// map의 value가 아니라 key에 room id가 있다.
// rooms.forEach((_, key) => {
//   if (sids.get(key) === undefined) {
//     console.log(key);
//   }
// });
// 위와 같이 하면 public room 정보를 가져올 수 있다.
