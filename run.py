if __name__ == "__main__":
    import online_pool
    proc = online_pool.start_server()

    from hypercorn.config import Config
    config = Config()
    config.application_path = "server:app"
    config.bind = ["0.0.0.0:42000"] 
    config.workers = 31
    config.keep_alive_timeout = 1
    config.max_requests = 10 ** 6
    config.keyfile = "ssl/key.pem"
    config.certfile = "ssl/cert.pem"
    config.errorlog = "server.log"

    from hypercorn.run import run
    run(config)
