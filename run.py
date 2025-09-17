from server import app
from cheroot import wsgi
from cheroot.ssl.builtin import BuiltinSSLAdapter

import sys
PROJECT_ROOT = sys.path[0]
sys.stdout = open(f"{PROJECT_ROOT}\\server.log", "a")
sys.stderr = open(f"{PROJECT_ROOT}\\server.log", "a")

server_args = {
    "bind_addr": ('0.0.0.0', 42000),
    "wsgi_app": app,
    "numthreads": 32,
}
server = wsgi.Server(**server_args)

try:
    adapter = BuiltinSSLAdapter(certificate=f"{PROJECT_ROOT}\\ssl\\cert.pem", private_key=f"{PROJECT_ROOT}\\ssl\\key.pem")
    server.ssl_adapter = adapter
    print("Starting HTTPS server...")
except Exception as e:
    print(f"Failed to start HTTPS server: {e}")
    print("Starting HTTP server instead...")
server.start()
