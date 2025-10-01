import socket, time, multiprocessing, logging
from flask import request

PORT = 8001

def server_process():
    logging.basicConfig(level=logging.ERROR, filemode='a', filename='server.log')
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("127.0.0.1", PORT))
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 2 ** 22)
    last_login = {}
    while True:
        try:
            query, addr = sock.recvfrom(1024)
            if query[0] == ord('Q'): # Query
                ret = time.time() - last_login.get(query[1:], 0) < 3
                sock.sendto(b'Y' if ret else b'N', addr)
            else: # Set
                last_login[query[1:]] = time.time()
        except socket.timeout:
            pass
        except Exception as e:
            logging.error("Online Pool Error: %s", e)

def start_server():
    p = multiprocessing.Process(target=server_process, daemon=True)
    p.start()
    return p

def start_client():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(1)
    request.online_pool_socket = sock

def stop_client(response):
    request.online_pool_socket.close()
    return response

def init_client(app):
    app.before_request(start_client)
    app.after_request(stop_client)

def is_online(uid: str) -> bool:
    request.online_pool_socket.sendto(b'Q' + uid.encode(), ("127.0.0.1", PORT))
    return request.online_pool_socket.recv(1024) == b'Y'

def set_online(uid: str):
    request.online_pool_socket.sendto(b'S' + uid.encode(), ("127.0.0.1", PORT))
