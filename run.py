if __name__ == "__main__":
    from hypercorn.config import Config
    config = Config()
    config.application_path = "server:app"
    config.bind = ["0.0.0.0:42000"] 
    config.workers = 32
    # config.keyfile = "ssl/key.pem"
    # config.certfile = "ssl/cert.pem"
    config.errorlog = "server.log"

    from hypercorn.run import run
    run(config)
