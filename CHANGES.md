### 1.1.0 ###
* Added: restart delay which is dynamically increased by the number of failed processes
* Added: SIGINT handler
* Added: simple example
* Added: promise based contol flow
* Added: minimalistic example
* Changed: some logging levels to notice/alert
* Changed: separated cluster startup, worker management and hot-reload logic

### 1.0.2 ###
* Bugfix: Invalid module export caused by previous renaming

### 1.0.1 ###
* Changed: increased kill timeout to 10s
* Bugfix: Hot-Reload callback won't executed in case the kill-timeout has been reached

### 1.0.0 ###
Initial Public Release