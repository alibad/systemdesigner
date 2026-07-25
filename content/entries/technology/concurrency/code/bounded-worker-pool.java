import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

final class BoundedWorkerPool {
    public static void main(String[] args) throws InterruptedException {
        CountDownLatch releaseWorkers = new CountDownLatch(1);
        ThreadPoolExecutor executor = new ThreadPoolExecutor(
                2,
                2,
                0,
                TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(2),
                new ThreadPoolExecutor.AbortPolicy());

        for (int taskId = 1; taskId <= 4; taskId++) {
            final int id = taskId;
            executor.execute(() -> {
                try {
                    if (id <= 2) {
                        releaseWorkers.await();
                    }
                    System.out.printf("completed task=%d%n", id);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                }
            });
        }

        try {
            executor.execute(() -> System.out.println("task 5 should not run"));
        } catch (RejectedExecutionException rejected) {
            System.out.println("rejected task=5 reason=2-running+2-queued");
        } finally {
            releaseWorkers.countDown();
            executor.shutdown();
        }

        if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
            executor.shutdownNow();
        }
    }
}
