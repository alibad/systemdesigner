package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Result struct {
	Value int
	Err   error
}

func generate(ctx context.Context, values []int) <-chan int {
	output := make(chan int)

	go func() {
		defer close(output)
		for _, value := range values {
			select {
			case output <- value:
			case <-ctx.Done():
				return
			}
		}
	}()

	return output
}

func transform(ctx context.Context, input <-chan int, workers int) <-chan Result {
	output := make(chan Result)
	var group sync.WaitGroup

	group.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer group.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case value, ok := <-input:
					if !ok {
						return
					}

					select {
					case output <- Result{Value: value * value}:
					case <-ctx.Done():
						return
					}
				}
			}
		}()
	}

	go func() {
		group.Wait()
		close(output)
	}()

	return output
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	input := generate(ctx, []int{2, 3, 4, 5, 6, 7})
	results := transform(ctx, input, 3)

	for result := range results {
		if result.Err != nil {
			fmt.Println("pipeline failed:", result.Err)
			continue
		}
		fmt.Println(result.Value)
	}
}
