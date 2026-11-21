package main_sing

import (
	"os"
	"time"
)

// A private stop file lets a console-less Windows core close its TUN adapter and
// routes normally. The desktop app and its crash watchdog own this path.
var obliqueStopFile string

func init() {
	mainCommand.PersistentFlags().StringVar(&obliqueStopFile, "oblique-stop-file", "", "Private desktop shutdown signal file")
}

func obliqueStopSignal() <-chan struct{} {
	if obliqueStopFile == "" {
		return nil
	}
	stopped := make(chan struct{})
	go func() {
		for {
			if _, err := os.Stat(obliqueStopFile); err == nil {
				close(stopped)
				return
			}
			time.Sleep(200 * time.Millisecond)
		}
	}()
	return stopped
}
