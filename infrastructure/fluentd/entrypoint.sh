#!/bin/bash

#source vars if file exists
DEFAULT=/etc/default/fluentd

if [[ -r $DEFAULT ]]; then
    set -o allexport
    . $DEFAULT
    set +o allexport
fi

# If the user has supplied only arguments append them to `fluentd` command
if [[ $# -gt 0 ]]; then
    exec fluentd "$@"
else
    exec fluentd
fi
