# Budget calculation

## This is an application for calculating the budget for all possible combinations of input parameters.

## Tech Stack

- **Docker** — used for containerization and creating isolated environments
- **MongoDB** — used as the database for storing data

## To install:

#### 1. Clone the repository

```
git clone https://github.com/modvise/media-budget-calculator.git
```

#### 2. Go to the required directory

```
   cd media-budget-calculator
```

#### 3. Install all dependencies

```
   npm install
```

#### 4. Add dev environments to "**./.env**" with following structure as example

```
DB_CONN_STRING="mongodb://localhost:27017/"
DB_NAME="lr-calc-data"
DB_LOG_NAME="lr-log-data"
REDIS_URL="redis://localhost:6379"
REDIS_PORT=6379
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=
```

#### 5. You need to install MongoDB locally and migrate all data from the PROD version

#### 6. You need to download the docker and install it

- 6.1 Download the Docker - [Docker official web site](https://www.docker.com/products/docker-desktop/) or from this link [Docker desktop app](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe?utm_source=docker&utm_medium=webreferral&utm_campaign=dd-smartbutton&utm_location=module)
- 6.2 Open the Command Line Interface(CLI) and enter the following command to pull the redis image:

```
docker pull redis
```

- 6.3 Create a new Redis Container

```
docker run -p 6379:6379 --name my-redis -d redis
```

- 6.4 To tun the Redis Container:

```
docker exec -it my-redis redis-cli
```

#### 7. Prepare all requests for calculating

```
npm run run:req
```

#### 8. Launch calculation

```
npm run run:calc
```
