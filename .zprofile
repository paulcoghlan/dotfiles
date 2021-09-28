eval $(/opt/homebrew/bin/brew shellenv)

export PATH=$PATH:~/Library/Python/3.9/bin:~/Library/Python/3.8/bin
export NOTES=$HOME/notes
export GOPATH=$HOME/go/
export PATH=$GOPATH/bin:$PATH

alias config='/usr/bin/git --git-dir=$HOME/.cfg/ --work-tree=$HOME'

alias gd='git diff'
alias gg='git log --oneline --abbrev-commit --all --graph --decorate --color'
alias ggl='git log --oneline --abbrev-commit --all --graph --decorate --color --stat'
#alias gr='git rebase -i'  # e.g. gr HEAD~10
alias gs='git status'
alias gph='git push'
alias gpl='git pull --rebase'

function gr() { git rebase -i HEAD~$1; }

function docker-rm() { dockrr rm -f $(docker ps -q -a) }
function clam() { freshclam; sudo clamscan -r --copy=$HOME/infected --log=$HOME/clamscan.log $1 }

# Prevent history being lost from multiple concurrent sessions
setopt APPEND_HISTORY
