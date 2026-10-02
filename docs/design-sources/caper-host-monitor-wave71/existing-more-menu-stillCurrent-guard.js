    const stillCurrent = () => actor === currentIdentity() && this.data.id === eventId &&
      this.data.event === event && this.data.event?.version === version &&
      this.data.currentUser === owner && this.data.loadState === loadState &&
      this.refreshId === refreshId;
