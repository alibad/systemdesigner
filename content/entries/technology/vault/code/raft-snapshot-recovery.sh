vault operator raft snapshot save vault-raft.snap

# In a controlled recovery environment with compatible seal access:
vault operator raft snapshot restore -force vault-raft.snap
vault status
vault operator raft list-peers

# Validate auth mounts, policies, secret engines, audit devices,
# dynamic credential issuance/revocation, and client re-authentication
# before redirecting production traffic.
