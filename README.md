# changepacks action

1. install changepacks
2. `changepacks check --format json`
3-1. if changepack logs are empty, check past commit and rollback, then `changepacks check --format json` if result is not empty, set changepacks of output to publish 
3-2. else create `change versions` pr after remove change logs
