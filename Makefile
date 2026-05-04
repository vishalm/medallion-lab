# Medallion Lab — thin Makefile wrapping run.sh.
#
# `run.sh` is the source of truth. This Makefile is just shorter typing
# for the commands people hit most often:
#
#   make            help
#   make dev        backend + frontend
#   make test       backend pytest + frontend Playwright
#   make up         docker compose up -d
#   make stop       docker compose stop  (keeps containers; quick restart)
#   make down       docker compose down  (removes containers; keeps volumes)
#   make wipe       docker compose down -v  (also deletes named volumes)
#
# `stop` vs `down`: `stop` halts the running containers but keeps them on
# disk so `make up` resumes in seconds. `down` removes the containers but
# keeps the named volumes (DB + Ollama models). `wipe` is the nuclear
# option — only use when you want a fully clean reseed.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

.PHONY: help install dev backend frontend build start lint \
        test test-backend test-unit test-e2e test-e2e-headed \
        up up-fg build-image stop start-container restart down wipe logs rebuild \
        reset health open clean ollama

help:
	@bash run.sh help

# ----- setup ----------------------------------------------------------
install:
	@bash run.sh install

ollama:
	@bash run.sh ollama

clean:
	@bash run.sh clean

# ----- develop --------------------------------------------------------
dev:
	@bash run.sh dev

backend:
	@bash run.sh backend

frontend:
	@bash run.sh frontend

# ----- build / serve --------------------------------------------------
build:
	@bash run.sh build

start:
	@bash run.sh start

lint:
	@bash run.sh lint

# ----- test -----------------------------------------------------------
test:
	@bash run.sh test

test-backend:
	@bash run.sh test:backend

test-unit:
	@bash run.sh test:unit

test-e2e:
	@bash run.sh test:e2e

test-e2e-headed:
	@bash run.sh test:e2e:headed

# ----- docker ---------------------------------------------------------
build-image:
	@bash run.sh docker:build

up:
	@bash run.sh docker:up

up-fg:
	@bash run.sh docker:up:fg

# Pause running containers without removing them — fastest restart path.
# Use `make down` if you actually want the containers torn down.
stop:
	@echo ">>> docker compose stop (containers paused, volumes intact)"
	@docker compose stop

# Resume a previously `stop`-ed stack.
start-container:
	@echo ">>> docker compose start"
	@docker compose start

restart:
	@echo ">>> docker compose restart"
	@docker compose restart

down:
	@bash run.sh docker:down

wipe:
	@bash run.sh docker:wipe

logs:
	@bash run.sh docker:logs

rebuild:
	@bash run.sh docker:rebuild

# ----- demo controls --------------------------------------------------
reset:
	@bash run.sh reset

health:
	@bash run.sh health

open:
	@bash run.sh open
