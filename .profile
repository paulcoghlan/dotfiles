# ~/.profile: executed by the command interpreter for login shells.
# This file is not read by bash(1), if ~/.bash_profile or ~/.bash_login
# exists.
# see /usr/share/doc/bash/examples/startup-files for examples.
# the files are located in the bash-doc package.

# the default umask is set in /etc/profile; for setting the umask
# for ssh logins, install and configure the libpam-umask package.
#umask 022

# if running bash
if [ -n "$BASH_VERSION" ]; then
    # include .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
	. "$HOME/.bashrc"
    fi
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/.local/bin" ] ; then
    PATH="$HOME/.local/bin:$PATH"
fi

alias config='/usr/bin/git --git-dir=/home/paul/.cfg/ --work-tree=/home/paul'

export PATH=$PATH:~/Library/Python/3.9/bin:~/Library/Python/3.8/bin
export NOTES=$HOME/notes
export GOPATH=$HOME/go/
export PATH=$GOPATH/bin:$PATH
export EDITOR=vi

alias config='/usr/bin/git --git-dir=$HOME/.cfg/ --work-tree=$HOME'

alias gd='git diff'
alias gg='git log --oneline --abbrev-commit --all --graph --decorate --color'
alias ggl='git log --oneline --abbrev-commit --all --graph --decorate --color --stat'
#alias gr='git rebase -i'  # e.g. gr HEAD~10
alias gs='git status'
alias gph='git push'
alias gpl='git pull --rebase'

function gr() { git rebase -i HEAD~$1; }

function docker-rm() { docker rm -f $(docker ps -q -a); }
function clam() { freshclam; sudo clamscan -r --copy=$HOME/infected --log=$HOME/clamscan.log $1; }

# Enable SSH Agent https://www.funtoo.org/Funtoo:Keychain
eval `keychain --eval --agents ssh 2018-03-01_id_rsa`

. "$HOME/.cargo/env"
