package main

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

type Job struct {
	ID int
}

func process(ctx context.Context, job Job) error {
	select {
	case <-time.After(40 * time.Millisecond):
		fmt.Printf("processed job %d\n", job.ID)
		return nil
	case <-ctx.Done():
		return context.Cause(ctx)
	}
}

func worker(ctx context.Context, jobs <-chan Job, wg *sync.WaitGroup) {
	defer wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-jobs:
			if !ok {
				return
			}
			if err := process(ctx, job); err != nil {
				return
			}
		}
	}
}

func submit(ctx context.Context, jobs chan<- Job, job Job) error {
	select {
	case jobs <- job:
		return nil
	case <-ctx.Done():
		return context.Cause(ctx)
	}
}

func main() {
	ctx, cancel := context.WithTimeoutCause(
		context.Background(),
		250*time.Millisecond,
		errors.New("batch deadline exceeded"),
	)
	defer cancel()

	const workerCount = 4
	jobs := make(chan Job, workerCount*2)

	var workers sync.WaitGroup
	workers.Add(workerCount)
	for i := 0; i < workerCount; i++ {
		go worker(ctx, jobs, &workers)
	}

	for id := 1; id <= 20; id++ {
		if err := submit(ctx, jobs, Job{ID: id}); err != nil {
			fmt.Printf("stopped admission: %v\n", err)
			break
		}
	}

	close(jobs)
	workers.Wait()
}
